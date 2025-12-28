
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20251227_make_func_volatile.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('Function get_current_org_id is now VOLATILE.');
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
