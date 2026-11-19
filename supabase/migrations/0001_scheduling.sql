create schema scheduling;
revoke all on schema scheduling from public;
create function scheduling.touch() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create function scheduling.immutable() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create table scheduling.resources (
 id uuid primary key default gen_random_uuid(), code text not null unique check(btrim(code)<>''),
 kind text not null check(kind in ('machine','operator')), name text not null,
 daily_minutes integer not null default 480 check(daily_minutes between 1 and 480),
 hold boolean not null default true, evidence text, review_due date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index resources_code_ci on scheduling.resources(lower(code));
create table scheduling.operations (
 id uuid primary key default gen_random_uuid(), code text not null unique check(btrim(code)<>''),
 order_code text not null check(btrim(order_code)<>''), sequence integer not null check(sequence>0),
 machine_id uuid not null references scheduling.resources, operator_id uuid not null references scheduling.resources,
 setup_minutes integer not null check(setup_minutes>=0), run_minutes integer not null check(run_minutes>0),
 ready_at timestamp not null, due_at timestamp not null,
 status text not null default 'planned' check(status in ('planned','done','cancelled')),
 material_ready boolean not null default false, note text not null default '',
 source_key text unique, source_payload jsonb, source_hash text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(order_code,sequence),check(machine_id<>operator_id)
);
create unique index operations_code_ci on scheduling.operations(lower(code));
create index operations_machine on scheduling.operations(machine_id);
create index operations_operator on scheduling.operations(operator_id);
create index operations_due on scheduling.operations(due_at) where status='planned';
create table scheduling.closures (
 id uuid primary key default gen_random_uuid(),resource_id uuid not null references scheduling.resources,
 closed_on date not null,reason text not null check(btrim(reason)<>''),unique(resource_id,closed_on),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table scheduling.activity (
 id uuid primary key default gen_random_uuid(),action text not null,actor text not null check(btrim(actor)<>''),detail jsonb not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table scheduling.plan_runs (
 id uuid primary key default gen_random_uuid(),start_on date not null,fingerprint text not null,actor text not null,
 result jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create function scheduling.resource_kinds() returns trigger language plpgsql as $$ begin
 if not exists(select 1 from scheduling.resources where id=new.machine_id and kind='machine') or not exists(select 1 from scheduling.resources where id=new.operator_id and kind='operator') then raise exception 'Operation needs a machine and an operator';end if;return new;end $$;
create trigger resource_kinds before insert or update on scheduling.operations for each row execute function scheduling.resource_kinds();
do $$ declare t text;begin
 foreach t in array array['resources','operations','closures','activity','plan_runs'] loop
 execute format('create trigger touch before update on scheduling.%I for each row execute function scheduling.touch()',t);
 execute format('alter table scheduling.%I enable row level security',t);
 end loop;
 foreach t in array array['activity','plan_runs'] loop
 execute format('create trigger immutable before update or delete on scheduling.%I for each row execute function scheduling.immutable()',t);
 end loop;end $$;
create view scheduling.operation_list with (security_invoker=true) as
 select o.id,o.code,o.order_code,o.sequence,m.code machine,p.code operator,o.setup_minutes,o.run_minutes,
 o.ready_at,o.due_at,o.status,o.material_ready,o.note from scheduling.operations o
 join scheduling.resources m on m.id=o.machine_id join scheduling.resources p on p.id=o.operator_id;
create view scheduling.capacity with (security_invoker=true) as
 select r.code,r.kind,r.daily_minutes,r.hold,r.review_due,
 coalesce(sum(o.setup_minutes+o.run_minutes) filter(where o.status='planned'),0)::int queued_minutes
 from scheduling.resources r left join scheduling.operations o on r.id=o.machine_id or r.id=o.operator_id group by r.id;
create view scheduling.compliance with (security_invoker=true) as
 select 'SAFE-01' rule,code record,'Recorded safety hold' finding from scheduling.resources where hold
 union all select 'SAFE-02',code,'Missing evidence or expired review' from scheduling.resources where nullif(btrim(evidence),'') is null or review_due is null or review_due<current_date
 union all select 'MAT-01',code,'Material readiness not confirmed' from scheduling.operations where status='planned' and not material_ready
 union all select 'DATA-01',code,'Due date precedes ready date' from scheduling.operations where status='planned' and due_at<ready_at;
create view scheduling.overdue with (security_invoker=true) as select * from scheduling.operation_list where status='planned' and due_at<current_timestamp;
revoke all on all tables in schema scheduling from public;
revoke all on all functions in schema scheduling from public;
