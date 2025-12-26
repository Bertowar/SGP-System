-- CHECK USER DETAILS
-- Verify what the database thinks about this user.
SELECT id,
    email,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users
WHERE email = 'bertowebmaster@gmail.com';
SELECT id,
    role,
    organization_id,
    is_super_admin,
    full_name
FROM public.profiles
WHERE id = (
        SELECT id
        FROM auth.users
        WHERE email = 'bertowebmaster@gmail.com'
    );