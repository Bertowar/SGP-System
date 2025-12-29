
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log("--- TRIGGERS ON RAW_MATERIALS ---");
        const res = await pool.query(`
            SELECT trigger_name, event_manipulation, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'raw_materials'
        `);
        res.rows.forEach(r => console.log(`[RAW] ${r.trigger_name} | ${r.event_manipulation} | ${r.action_timing}`));

        console.log("\n--- TRIGGERS ON INVENTORY_TRANSACTIONS ---");
        const res2 = await pool.query(`
            SELECT trigger_name, event_manipulation, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'inventory_transactions'
        `);
        res2.rows.forEach(r => console.log(`[TRX] ${r.trigger_name} | ${r.event_manipulation} | ${r.action_timing}`));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};
run();
