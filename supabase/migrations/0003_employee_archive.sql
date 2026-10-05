-- Deleting an employee who has history (hours, completed jobs, photos…) archives
-- them instead, so payroll and job costing keep pointing at a real row.
alter table employees add column if not exists archived boolean not null default false;

-- Never let a delete wipe hours worked: time entries must outlive their employee row.
alter table time_entries drop constraint if exists time_entries_employee_id_fkey;
alter table time_entries
  add constraint time_entries_employee_id_fkey
  foreign key (employee_id) references employees(id) on delete restrict;
