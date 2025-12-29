
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log("Applying RLS Fix...");

        await pool.query(`
            BEGIN;
            -- Drop potential old policies
            DROP POLICY IF EXISTS "Strict isolation for materials" ON public.raw_materials;
            DROP POLICY IF EXISTS "Isolation for raw_materials" ON public.raw_materials;
            DROP POLICY IF EXISTS "Enable read access for all users" ON public.raw_materials;
            DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.raw_materials;
            
            -- Create New Policies
            CREATE POLICY "View materials of own org" ON public.raw_materials
            FOR SELECT
            USING (
                organization_id IN (
                    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
                )
            );

            CREATE POLICY "Manage materials of own org" ON public.raw_materials
            FOR ALL
            USING (
                organization_id IN (
                    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
                )
            )
            WITH CHECK (
                organization_id IN (
                    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
                )
            );
            
            COMMIT;
        `);
        console.log("RLS Fix Applied Successfully.");

        const res = await pool.query(`select policyname from pg_policies where tablename = 'raw_materials'`);
        console.log("ACTIVE POLICIES:");
        res.rows.forEach(r => console.log(`- ${r.policyname}`));

    } catch (e) {
        console.error("ERROR:", e);
        await pool.query('ROLLBACK');
    } finally {
        await pool.end();
    }
};
run();
