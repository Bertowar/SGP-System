
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log('Applying Strict RLS Migration...');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20251227_strict_rls.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('Strict RLS Applied.');
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
}
run();
