
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT pg_get_functiondef('public.get_current_org_id'::regproc)");
        console.log(res.rows[0].pg_get_functiondef);
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
