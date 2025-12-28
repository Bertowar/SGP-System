
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20251227_rpc_switch_org.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('RPC switch_organization created.');
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
