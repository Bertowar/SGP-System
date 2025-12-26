-- DIAGNOSE AND FIX APP_SETTINGS 406
-- Run this in Supabase SQL Editor
-- 1. Unblock the UI immediately by disabling RLS on app_settings (Temporary Fix)
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
-- 2. Verify the function status (Check if it is really SECURITY DEFINER)
SELECT proname,
    prosecdef,
    proconfig
FROM pg_proc
WHERE proname = 'get_current_org_id';
-- 3. Check if RLS is active on profiles (Should be ENABLED)
SELECT tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';
-- If the UI loads after running this, the issue was definitely RLS on app_settings.
-- We can refine the policy later, but this gets the system running.