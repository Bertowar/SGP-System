-- Tabela de Roteiros de Produto (Cabeçalho)
create table if not exists public.product_routes (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid references public.organizations(id) not null,
    product_id uuid references public.products(id) on delete cascade,
    version integer default 1,
    active boolean default true,
    description text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
-- Tabela de Etapas do Roteiro
create table if not exists public.route_steps (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid references public.organizations(id) not null,
    route_id uuid references public.product_routes(id) on delete cascade not null,
    step_order integer not null,
    -- 10, 20, 30
    machine_group_id text,
    -- "Extrusora", etc.
    setup_time numeric default 0,
    -- Minutes
    cycle_time numeric default 0,
    -- Seconds per unit
    min_lot_transfer numeric default 1,
    description text,
    created_at timestamptz default now()
);
-- RLS Policies for product_routes
alter table public.product_routes enable row level security;
create policy "Enable read access for organization members" on public.product_routes for
select using (organization_id = get_current_org_id());
create policy "Enable write access for organization members" on public.product_routes for all using (organization_id = get_current_org_id()) with check (organization_id = get_current_org_id());
-- RLS Policies for route_steps
alter table public.route_steps enable row level security;
create policy "Enable read access for organization members" on public.route_steps for
select using (organization_id = get_current_org_id());
create policy "Enable write access for organization members" on public.route_steps for all using (organization_id = get_current_org_id()) with check (organization_id = get_current_org_id());
-- Indexes
create index if not exists idx_product_routes_org on public.product_routes(organization_id);
create index if not exists idx_product_routes_product on public.product_routes(product_id);
create index if not exists idx_route_steps_route on public.route_steps(route_id);
create index if not exists idx_route_steps_org on public.route_steps(organization_id);