-- Allow authenticated users to create organizations
CREATE POLICY "Allow authenticated to create organizations" ON public.organizations FOR
INSERT TO authenticated WITH CHECK (true);
-- Allow users to update their own profile (to link org)
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR
UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);