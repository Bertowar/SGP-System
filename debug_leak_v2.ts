
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const runDebug = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- Checking for NULL organization_id (Potential Leak Source) ---');

        const tables = ['products', 'raw_materials', 'sectors', 'product_categories', 'inventory_transactions'];

        for (const t of tables) {
            // Check count of NULLs
            const res = await pool.query(`SELECT count(*) as cnt FROM ${t} WHERE organization_id IS NULL`);
            const count = res.rows[0].cnt;

            // Check count of VALID IDs (just to see if migration worked)
            const resValid = await pool.query(`SELECT count(*) as cnt FROM ${t} WHERE organization_id IS NOT NULL`);
            const countValid = resValid.rows[0].cnt;

            console.log(`Table: ${t.padEnd(25)} | NULLs: ${count.padEnd(5)} | Valid: ${countValid}`);
        }

    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
runDebug();
