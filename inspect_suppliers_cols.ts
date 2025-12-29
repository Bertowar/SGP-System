
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log("--- COLUMNS ON SUPPLIERS ---");
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'suppliers';
        `);
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};
run();
