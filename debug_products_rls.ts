
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- PRODUCTS RLS ---');
        const rls = await pool.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'products'");
        console.log(rls.rows[0]);

        console.log('--- PRODUCTS POLICIES ---');
        const pol = await pool.query("SELECT policyname, qual, cmd FROM pg_policies WHERE tablename = 'products'");
        console.table(pol.rows);

        console.log('--- COUNT NULL ORG ---');
        const cnt = await pool.query("SELECT count(*) FROM products WHERE organization_id IS NULL");
        console.log('NULLs:', cnt.rows[0].count);

    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
