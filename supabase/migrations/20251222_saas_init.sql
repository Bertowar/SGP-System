-- MIGRATION: 20251222_saas_init.sql
-- DESCRIPTION: Inicialização do módulo SaaS (Organizations, Profiles, RLS e Triggers)

-- 1. Create PUBLIC Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    cnpj TEXT,
    plan TEXT CHECK (plan IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
    owner_id UUID NOT NULL, -- Initial owner reference
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create or Update PUBLIC Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id),
    full_name TEXT,
    role TEXT DEFAULT 'entry',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table already existed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'organization_id') THEN
        ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'entry';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Index for RLS performance
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 3. Function to Get Current Org ID (RLS Helper)
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 4. RLS for Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization" ON public.organizations
FOR SELECT USING (
  id = public.get_current_org_id()
);

-- Only owner can update organization details
CREATE POLICY "Owners can update their organization" ON public.organizations
FOR UPDATE USING (
  id = public.get_current_org_id() AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
);

-- 5. RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of same organization" ON public.profiles
FOR SELECT USING (
  organization_id = public.get_current_org_id() OR id = auth.uid()
);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (
  id = auth.uid()
);

-- 6. Trigger to create Profile on User Sign Up
-- NOTE: This requires 'public.organizations' to have a default org if we want auto-assignment,
-- OR we handle the Invite Flow where metadata contains 'organization_id'.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_org_id UUID;
  target_role TEXT;
BEGIN
  -- Check user_metadata for invite info
  target_org_id := (new.raw_user_meta_data->>'organization_id')::UUID;
  target_role := (new.raw_user_meta_data->>'role');
  
  -- Validation: If no org provided, maybe create a default one for the user?
  -- SaaS Policy: If signing up freely, create a new Org for them.
  IF target_org_id IS NULL THEN
     INSERT INTO public.organizations (name, slug, owner_id)
     VALUES (
        COALESCE(new.raw_user_meta_data->>'company_name', 'Minha Empresa'),
        lower(regexp_replace(COALESCE(new.raw_user_meta_data->>'company_name', 'org-' || substring(new.id::text from 1 for 8)), '\s+', '-', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 4),
        new.id
     ) RETURNING id INTO target_org_id;
     
     target_role := 'owner'; -- Default role for new org creator
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, role)
  VALUES (
    new.id,
    target_org_id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(target_role, 'owner')
  );
  
  RETURN new;
END;
$$;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Add organization_id to existing Tables (Tenant Isolation)
-- Assuming existing data belongs to a Default Organization (Migration Step)
-- DO NOT RUN THIS BLOCK BLINDLY without a default organization existing first if data exists.
-- Providing logic for review.

/*
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
-- Enable RLS on these tables...
*/
