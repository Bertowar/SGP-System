
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        // Find the function name for the trigger first (or assume standard naming, but let's query pg_proc)
        // Actually, just listing functions with 'stock' in name might be faster.
        const res = await pool.query(`
            SELECT p.proname, pg_get_functiondef(p.oid) as def
            FROM pg_proc p
            WHERE p.proname ILIKE '%update_stock%' OR p.proname ILIKE '%transaction%'
        `);
        res.rows.forEach(r => {
            console.log(`\n\n--- FUNCTION: ${r.proname} ---\n${r.def}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};
run();
