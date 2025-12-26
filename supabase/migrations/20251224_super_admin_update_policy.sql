-- Migration: Allow Super Admins to update organizations
-- Description: Adds RLS policy for Super Admin update access on organizations table
CREATE POLICY "Super Admins can update any organization" ON public.organizations FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND is_super_admin = true
        )
    );