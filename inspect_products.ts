
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- DEPENDENT TABLES INSPECTION ---');

        const queries = [
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'production_orders'",
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'production_entries'",
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'product_bom'"
        ];

        for (const q of queries) {
            console.log(`QUERY: ${q}`);
            const res = await pool.query(q);
            console.log(JSON.stringify(res.rows.map(r => r.column_name)));
        }

    } catch (e) {
        console.error("ERROR EXECUTION:", e);
    } finally {
        await pool.end();
    }
};
run();
