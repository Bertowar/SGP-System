
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log("--- RLS POLICIES ON INVENTORY_TRANSACTIONS ---");
        const res = await pool.query(`
            SELECT policyname, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'inventory_transactions'
        `);
        res.rows.forEach(r => {
            console.log(`[POL] ${r.policyname} (${r.cmd})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};
run();
