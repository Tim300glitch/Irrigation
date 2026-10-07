-- Price book: links, per-line options (size, zones, wire type…) and default kits
alter table inventory_items add column if not exists links       jsonb not null default '[]'::jsonb;
alter table inventory_items add column if not exists options     jsonb not null default '[]'::jsonb;
alter table inventory_items add column if not exists default_for jsonb not null default '[]'::jsonb;

-- options chosen on a line (e.g. {"Zones": "8"})
alter table estimate_items add column if not exists options jsonb;
alter table job_items      add column if not exists options jsonb;
alter table invoice_items  add column if not exists options jsonb;

-- jobs can be archived (hidden, history kept)
alter table jobs add column if not exists archived boolean not null default false;

-- purchase orders
create table if not exists purchase_orders (
  id           text primary key,
  org_id       text not null references organizations(id) on delete cascade,
  number       integer not null,
  vendor_id    text references vendors(id) on delete set null,
  status       text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  items        jsonb not null default '[]'::jsonb,
  deliver_to   text not null default 'warehouse',
  needed_by    date,
  job_id       text references jobs(id) on delete set null,
  notes        text not null default '',
  created_by   text references employees(id) on delete set null,
  created_at   timestamptz not null default now(),
  ordered_at   timestamptz,
  received_at  timestamptz,
  updated_at   timestamptz not null default now(),
  unique (org_id, number)
);
create index if not exists purchase_orders_vendor on purchase_orders(org_id, vendor_id);

alter table purchase_orders enable row level security;
drop policy if exists purchase_orders_org on purchase_orders;
create policy purchase_orders_org on purchase_orders for all
  using (org_id = current_org()) with check (org_id = current_org());

drop trigger if exists purchase_orders_updated on purchase_orders;
create trigger purchase_orders_updated before update on purchase_orders
  for each row execute function set_updated_at();
