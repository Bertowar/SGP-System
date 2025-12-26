-- Migration: Add logo_url to organizations and storage setup
-- Description: Adds logo_url column and configures storage for organization logos
-- 1. Add logo_url column if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'organizations'
        AND column_name = 'logo_url'
) THEN
ALTER TABLE public.organizations
ADD COLUMN logo_url TEXT;
END IF;
END $$;
-- 2. Create Storage Bucket for Logos (if valid via SQL, otherwise we guide user/do via Client)
-- NOTE: Creating buckets via SQL is not standard in Supabase migrations usually, better to ensure it exists via client or dashboard.
-- However, we can create Policies for it.
-- Assume bucket name is 'logos'
-- Policy: Public Read
BEGIN;
-- Try to insert bucket if not exists (works if storage schema is accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
COMMIT;
-- Policy: Authenticated users can upload (for Super Admin usage, or generally for org owners)
CREATE POLICY "Public Read Logos" ON storage.objects FOR
SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated Users Upload Logos" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id = 'logos'
        AND auth.role() = 'authenticated'
    );
CREATE POLICY "Owners Update Logos" ON storage.objects FOR
UPDATE USING (
        bucket_id = 'logos'
        AND auth.uid() = owner
    );