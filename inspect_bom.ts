
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'product_bom'
        `);
        res.rows.forEach(r => console.log(r.column_name));
    } catch (e) {
        console.error("ERROR EXECUTION:", e);
    } finally {
        await pool.end();
    }
};
run();
