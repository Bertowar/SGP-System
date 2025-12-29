
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- RAW MATERIALS TABLE DUMP (Top 5) ---');
        const res = await pool.query('SELECT id, name, code, organization_id, created_at FROM raw_materials ORDER BY created_at DESC LIMIT 5');
        console.table(res.rows);
    } catch (e) {
        console.error("ERROR EXECUTION:", e);
    } finally {
        await pool.end();
    }
};
run();
