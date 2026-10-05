-- ════════════════════════════════════════════════════════════════════════
-- Row-level security, role permissions, derived views, numbering and search
-- ════════════════════════════════════════════════════════════════════════

-- ───────────────────────── Helpers ─────────────────────────

create or replace function current_org() returns text
language sql stable security definer set search_path = public as $$
  select org_id from users where id = auth.uid()
$$;

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid()
$$;

create or replace function current_employee() returns text
language sql stable security definer set search_path = public as $$
  select employee_id from users where id = auth.uid()
$$;

create or replace function is_office() returns boolean
language sql stable as $$
  select current_role_name() in ('owner','admin','office','estimator')
$$;

-- ───────────────────────── RLS: org isolation on every tenant table ─────────────────────────

do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'org_id' and table_name <> 'users'
  loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy %I on %I for all
                     using (org_id = current_org())
                     with check (org_id = current_org())$p$, t || '_org', t);
  end loop;
end $$;

alter table users enable row level security;
create policy users_self on users for select using (id = auth.uid() or org_id = current_org());
create policy users_admin on users for all using (org_id = current_org() and current_role_name() in ('owner','admin'));

alter table organizations enable row level security;
create policy org_member on organizations for select using (id = current_org());
create policy org_admin on organizations for update using (id = current_org() and current_role_name() in ('owner','admin'));

-- Child tables without org_id inherit visibility from their parent.
do $$
declare r record;
begin
  for r in select * from (values
      ('estimate_options','estimates','estimate_id'),
      ('estimate_items','estimates','estimate_id'),
      ('job_items','jobs','job_id'),
      ('job_checklist_items','jobs','job_id'),
      ('job_costs','jobs','job_id'),
      ('job_crew','jobs','job_id'),
      ('job_zones','jobs','job_id'),
      ('invoice_items','invoices','invoice_id'),
      ('appointment_employees','appointments','appointment_id')
    ) as v(child, parent, fk)
  loop
    execute format('alter table %I enable row level security', r.child);
    execute format($p$create policy %I on %I for all
                     using (exists (select 1 from %I p where p.id = %I.%I and p.org_id = current_org()))$p$,
                   r.child || '_parent', r.child, r.parent, r.child, r.fk);
  end loop;
  -- valves / sprinklers via components
  alter table valves enable row level security;
  create policy valves_parent on valves for all using (exists (select 1 from components c where c.id = component_id and c.org_id = current_org()));
  alter table sprinklers enable row level security;
  create policy sprinklers_parent on sprinklers for all using (exists (select 1 from components c where c.id = component_id and c.org_id = current_org()));
end $$;

-- Field roles: technicians / helpers only see financial tables through views, and
-- can only modify jobs they are assigned to. (Office roles keep full org access.)
create policy jobs_field_update on jobs as restrictive for update
  using (is_office() or assigned_to = current_employee() or exists (select 1 from job_crew c where c.job_id = jobs.id and c.employee_id = current_employee()));

create policy payments_office on payments as restrictive for delete using (is_office());
create policy invoices_office on invoices as restrictive for delete using (is_office());
create policy employees_office on employees as restrictive for update using (is_office() or id = current_employee());

-- ───────────────────────── Document numbering ─────────────────────────

create table number_sequences (
  org_id  text not null references organizations(id) on delete cascade,
  kind    text not null check (kind in ('estimate','job','invoice','change_order')),
  next    integer not null default 1001,
  primary key (org_id, kind)
);
alter table number_sequences enable row level security;
create policy number_sequences_org on number_sequences for all using (org_id = current_org());

create or replace function next_number(p_kind text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into number_sequences(org_id, kind) values (current_org(), p_kind) on conflict do nothing;
  update number_sequences set next = next + 1 where org_id = current_org() and kind = p_kind returning next - 1 into n;
  return n;
end $$;

-- ───────────────────────── Derived views ─────────────────────────

-- Invoice totals and balances (mirrors src/lib/crm/calc.ts invoiceTotals)
create or replace view invoice_balances with (security_invoker = true) as
select i.id, i.org_id, i.customer_id, i.status, i.due_date,
       t.subtotal,
       case when i.discount_type = 'pct' then round(t.subtotal * i.discount_value / 100, 2) else i.discount_value end as discount,
       round(t.taxable * (1 - case when i.discount_type = 'pct' then i.discount_value / 100 else 0 end) * i.tax_pct / 100, 2) as tax,
       coalesce(p.paid, 0) as paid
from invoices i
cross join lateral (
  select coalesce(sum(qty * unit_price), 0) as subtotal,
         coalesce(sum(qty * unit_price) filter (where taxable), 0) as taxable
  from invoice_items where invoice_id = i.id) t
left join lateral (select sum(amount) as paid from payments where invoice_id = i.id) p on true;

-- Job costing: actual cost vs estimate (labor from time entries × burdened wage)
create or replace view job_costing with (security_invoker = true) as
select j.id, j.org_id, j.number, j.service_type, j.assigned_to, j.completed_at,
       j.est_revenue, j.est_material_cost, j.est_labor_cost, j.estimated_labor_hours,
       coalesce(inv.revenue, j.est_revenue) as revenue,
       coalesce(m.material_cost, 0) as material_cost,
       coalesce(l.labor_hours, 0) as labor_hours,
       coalesce(l.labor_cost, 0) as labor_cost,
       coalesce(c.other_cost, 0) as other_cost,
       coalesce(inv.revenue, j.est_revenue) - coalesce(m.material_cost,0) - coalesce(l.labor_cost,0) - coalesce(c.other_cost,0) as gross_profit
from jobs j
left join lateral (select sum(coalesce(used_qty, qty) * unit_cost) as material_cost from job_items where job_id = j.id and kind = 'material') m on true
left join lateral (
  select sum(extract(epoch from (coalesce(t.ends_at, now()) - t.starts_at)) / 3600) as labor_hours,
         sum(extract(epoch from (coalesce(t.ends_at, now()) - t.starts_at)) / 3600 * e.pay_rate
             * (1 + coalesce((o.settings->>'laborBurdenPct')::numeric, 0) / 100)) as labor_cost
  from time_entries t join employees e on e.id = t.employee_id join organizations o on o.id = j.org_id
  where t.job_id = j.id and t.type in ('job','travel')) l on true
left join lateral (select sum(amount) as other_cost from job_costs where job_id = j.id) c on true
left join lateral (select sum(b.subtotal - b.discount) as revenue from invoice_balances b join invoices i on i.id = b.id where i.job_id = j.id and i.status <> 'void') inv on true;

-- Lead source performance
create or replace view lead_source_performance with (security_invoker = true) as
select l.org_id, l.source,
       count(*) as leads,
       count(*) filter (where l.stage = 'approved') as won,
       round(100.0 * count(*) filter (where l.stage = 'approved') / nullif(count(*) filter (where l.stage in ('approved','lost')), 0), 1) as close_rate,
       coalesce(sum(r.revenue), 0) as revenue
from leads l
left join lateral (select sum(b.subtotal - b.discount) as revenue from invoice_balances b where b.customer_id = l.customer_id) r on true
group by l.org_id, l.source;

-- Inventory needing reorder (warehouse + trucks)
create or replace view low_stock with (security_invoker = true) as
select i.id, i.org_id, i.name, i.sku, i.warehouse_qty, i.min_qty, i.reorder_qty,
       coalesce(sum(t.qty), 0) as truck_qty
from inventory_items i left join truck_inventory t on t.item_id = i.id
where i.stocked and i.active
group by i.id
having i.warehouse_qty <= i.min_qty;

-- ───────────────────────── Global search ─────────────────────────
-- One query across customers, properties, jobs, estimates, invoices, zones,
-- components, controllers, employees and price book items. Example:
--   select * from global_search('Rain Bird 5000');  → every property with that model

create or replace function global_search(q text, max_rows int default 40)
returns table (kind text, id text, title text, subtitle text, property_id text, score real)
language sql stable security invoker set search_path = public as $$
  with s as (select q as q)
  select * from (
    select 'customer', c.id, c.first_name || ' ' || c.last_name, coalesce(c.phone,'') || ' · ' || coalesce(c.email,''), null::text,
           similarity(c.first_name || ' ' || c.last_name || ' ' || coalesce(c.company,'') || ' ' || coalesce(c.phone,'') || ' ' || coalesce(c.email,''), (select q from s))
      from customers c
    union all
    select 'property', p.id, p.street, coalesce(p.city,'') || ' · gate ' || coalesce(p.gate_code,'-'), p.id,
           similarity(p.street || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.zip,''), (select q from s))
      from properties p
    union all
    select 'job', j.id, '#' || j.number || ' ' || j.title, j.status, j.property_id, similarity('#' || j.number || ' ' || j.title, (select q from s)) from jobs j
    union all
    select 'estimate', e.id, 'EST-' || e.number || ' ' || e.title, e.status, e.property_id, similarity('EST-' || e.number || ' ' || e.title, (select q from s)) from estimates e
    union all
    select 'invoice', i.id, 'INV-' || i.number, i.status, i.property_id, similarity('INV-' || i.number, (select q from s)) from invoices i
    union all
    select 'zone', z.id, 'Zone ' || z.number || ' ' || z.name, coalesce(z.manufacturer,'') || ' ' || coalesce(z.model,''), sy.property_id,
           similarity(coalesce(z.manufacturer,'') || ' ' || coalesce(z.model,'') || ' ' || coalesce(z.notes,'') || ' ' || coalesce(z.valve_location,''), (select q from s))
      from zones z join irrigation_systems sy on sy.id = z.system_id
    union all
    select 'component', co.id, coalesce(co.manufacturer,'') || ' ' || coalesce(co.model,''), co.type, sy.property_id,
           similarity(coalesce(co.manufacturer,'') || ' ' || coalesce(co.model,'') || ' ' || coalesce(co.notes,''), (select q from s))
      from components co join irrigation_systems sy on sy.id = co.system_id
    union all
    select 'controller', ct.id, ct.manufacturer || ' ' || ct.model, ct.location, sy.property_id, similarity(ct.manufacturer || ' ' || ct.model, (select q from s))
      from controllers ct join irrigation_systems sy on sy.id = ct.system_id
    union all
    select 'employee', em.id, em.first_name || ' ' || em.last_name, em.role, null, similarity(em.first_name || ' ' || em.last_name, (select q from s)) from employees em
    union all
    select 'item', it.id, it.name, it.sku, null, similarity(it.name || ' ' || coalesce(it.sku,'') || ' ' || coalesce(it.manufacturer,''), (select q from s)) from inventory_items it
  ) r(kind, id, title, subtitle, property_id, score)
  where score > 0.15
  order by score desc
  limit max_rows
$$;

-- ───────────────────────── Domain triggers ─────────────────────────

-- Using materials on a job reduces stock: insert an inventory transaction with
-- reason 'used' and the trigger decrements the truck (or warehouse) quantity.
create or replace function apply_inventory_txn() returns trigger language plpgsql as $$
begin
  if new.truck_id is null then
    update inventory_items set warehouse_qty = warehouse_qty + new.qty where id = new.item_id;
  else
    insert into truck_inventory(id, org_id, truck_id, item_id, qty)
    values (new.id, new.org_id, new.truck_id, new.item_id, new.qty)
    on conflict (truck_id, item_id) do update set qty = truck_inventory.qty + excluded.qty;
  end if;
  return new;
end $$;
create trigger inventory_txn_apply after insert on inventory_transactions for each row execute function apply_inventory_txn();

-- Payment received → update invoice status
create or replace function refresh_invoice_status() returns trigger language plpgsql as $$
declare b record; total numeric;
begin
  select * into b from invoice_balances where id = coalesce(new.invoice_id, old.invoice_id);
  if b is null then return null; end if;
  total := b.subtotal - b.discount + b.tax - (select deposit_credit from invoices where id = b.id);
  update invoices set
    status = case when b.paid >= total - 0.005 then 'paid' when b.paid > 0 then 'partial' else status end,
    paid_at = case when b.paid >= total - 0.005 then now() else null end
  where id = b.id and status <> 'void';
  return null;
end $$;
create trigger payments_invoice_status after insert or update or delete on payments for each row execute function refresh_invoice_status();

-- ───────────────────────── Storage ─────────────────────────
-- Bucket "media" holds photos, documents, signatures and map backgrounds under
-- <org_id>/<entity_type>/<entity_id>/<file>.
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict do nothing;
create policy media_org_read on storage.objects for select using (bucket_id = 'media' and (storage.foldername(name))[1] = current_org());
create policy media_org_write on storage.objects for insert with check (bucket_id = 'media' and (storage.foldername(name))[1] = current_org());
create policy media_org_delete on storage.objects for delete using (bucket_id = 'media' and (storage.foldername(name))[1] = current_org() and is_office());
