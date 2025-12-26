-- RUN THIS IN SUPABASE SQL EDITOR
-- Update profiles by looking up the ID in the auth.users table (where the email actually lives)
UPDATE public.profiles
SET is_super_admin = TRUE
WHERE id = (
        SELECT id
        FROM auth.users
        WHERE email = 'bertowebmaster@gmail.com'
    );
-- Verify the change
SELECT id,
    role,
    is_super_admin
FROM public.profiles
WHERE is_super_admin = TRUE;