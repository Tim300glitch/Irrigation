import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import fs from "fs";
import path from "path";

// Applies the migrations to an in-memory Postgres (PGlite) with stubs for the
// Supabase auth/storage schemas, then smoke-tests triggers, views and search.
const dir = path.dirname(new URL(import.meta.url).pathname);
const db = new PGlite({ extensions: { pg_trgm } });
await db.exec(`
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(id uuid, bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
`);
for (const f of fs.readdirSync(`${dir}/../migrations`).filter((x) => x.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(`${dir}/../migrations/${f}`, "utf8");
  try { await db.exec(sql); console.log("OK", f); } catch (e) { console.log("FAIL", f, e.message, e.position ? sql.slice(Math.max(0, e.position - 200), e.position + 100) : ""); process.exit(1); }
}
const t = await db.query(`select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
const v = await db.query(`select count(*) from information_schema.views where table_schema='public'`);
const pol = await db.query(`select count(*) from pg_policies`);
console.log("tables", t.rows[0].count, "views", v.rows[0].count, "policies", pol.rows[0].count);
// smoke data
await db.exec(`insert into organizations(id,name) values('o1','Test');
insert into customers(id,org_id,first_name,last_name) values('c1','o1','Bill','Thompson');
insert into properties(id,org_id,customer_id,name,street) values('p1','o1','c1','Home','18800 Los Alamos Rd');
insert into irrigation_systems(id,org_id,property_id) values('s1','o1','p1');
insert into zones(id,org_id,system_id,number,name,manufacturer,model) values('z1','o1','s1',1,'Front Lawn','Rain Bird','5000 Plus PC');
insert into invoices(id,org_id,number,customer_id,issue_date,due_date,tax_pct,status) values('i1','o1',3001,'c1','2026-09-01','2026-09-16',7.75,'sent');
insert into invoice_items(id,invoice_id,kind,name,qty,unit_price,taxable) values('ii1','i1','material','Rotor',4,32,true),('ii2','i1','labor','Labor',2,95,false);
insert into payments(id,org_id,invoice_id,customer_id,amount,method) values('pay1','o1','i1','c1',100,'card');
insert into warranties(id,org_id,customer_id,property_id,item,installed_date,labor_months,manufacturer_months) values('w1','o1','c1','p1','Valve','2026-01-04',12,60);`);
const bal = (await db.query(`select subtotal, tax, paid from invoice_balances`)).rows[0];
if (Number(bal.subtotal) !== 318 || Number(bal.tax) !== 9.92) throw new Error("invoice_balances mismatch " + JSON.stringify(bal));
if ((await db.query(`select status from invoices`)).rows[0].status !== "partial") throw new Error("payment trigger did not update invoice status");

if (!(await db.query(`select kind from global_search('Rain Bird 5000')`)).rows.length) throw new Error("global_search found nothing");
console.log("triggers, views and global_search OK");
