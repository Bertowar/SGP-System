-- MIGRATION: 20251222_super_admin.sql
-- DESCRIPTION: Adiciona suporte a Super Admin (Global View)

-- 1. Add is_super_admin column to profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_super_admin') THEN
        ALTER TABLE public.profiles ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Update RLS for Organizations (Allow Super Admin to see ALL)
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view their own organization" ON public.organizations
FOR SELECT USING (
  id = public.get_current_org_id()
  OR
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())
);

-- 3. Update RLS for Profiles (Allow Super Admin to see ALL profiles)
DROP POLICY IF EXISTS "Users can view members of same organization" ON public.profiles;

CREATE POLICY "Users can view members of same organization" ON public.profiles
FOR SELECT USING (
  organization_id = public.get_current_org_id() 
  OR id = auth.uid()
  OR
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())
);

-- 4. Allow Super Admin to Update Organizations (Optional: if they need to edit plans etc)
DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;

CREATE POLICY "Owners and Super Admins can update organization" ON public.organizations
FOR UPDATE USING (
  (id = public.get_current_org_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'))
  OR
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())
);
