-- Tabela de Reservas de Material (MRP)
create table if not exists public.material_reservations (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid references public.organizations(id) not null,
    production_order_id text references public.production_orders(id) on delete cascade not null,
    material_id uuid references public.raw_materials(id) on delete restrict not null,
    quantity numeric not null default 0,
    status text default 'PENDING',
    -- PENDING, CONSUMED, RELEASED
    created_at timestamptz default now()
);
-- Tabela de Etapas da Ordem (Work Orders / Chão de Fábrica)
create table if not exists public.production_order_steps (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid references public.organizations(id) not null,
    production_order_id text references public.production_orders(id) on delete cascade not null,
    step_id uuid references public.route_steps(id) on delete restrict not null,
    machine_id text,
    -- Pode ser nulo inicialmente (será preenchido na execução)
    operator_id bigint,
    -- Pode ser nulo
    status text default 'PENDING',
    -- PENDING, READY, IN_PROGRESS, PAUSED, COMPLETED
    qty_planned numeric default 0,
    qty_produced numeric default 0,
    qty_rejected numeric default 0,
    start_time timestamptz,
    end_time timestamptz,
    created_at timestamptz default now()
);
-- RLS Policies for material_reservations
alter table public.material_reservations enable row level security;
create policy "Enable read access for organization members" on public.material_reservations for
select using (organization_id = get_current_org_id());
create policy "Enable write access for organization members" on public.material_reservations for all using (organization_id = get_current_org_id()) with check (organization_id = get_current_org_id());
-- RLS Policies for production_order_steps
alter table public.production_order_steps enable row level security;
create policy "Enable read access for organization members" on public.production_order_steps for
select using (organization_id = get_current_org_id());
create policy "Enable write access for organization members" on public.production_order_steps for all using (organization_id = get_current_org_id()) with check (organization_id = get_current_org_id());
-- Indexes
create index if not exists idx_mat_res_org on public.material_reservations(organization_id);
create index if not exists idx_mat_res_op on public.material_reservations(production_order_id);
create index if not exists idx_op_steps_org on public.production_order_steps(organization_id);
create index if not exists idx_op_steps_op on public.production_order_steps(production_order_id);
create index if not exists idx_op_steps_machine on public.production_order_steps(machine_id);