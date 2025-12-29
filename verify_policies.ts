
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`select policyname from pg_policies where tablename = 'raw_materials'`);
        console.log("POLICIES:");
        res.rows.forEach(r => console.log(r.policyname));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};
run();
