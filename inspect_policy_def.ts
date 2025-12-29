
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`
            SELECT policyname, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'raw_materials'
        `);
        console.log("POLICIES DETAILED:");
        res.rows.forEach(r => {
            console.log(`Name: ${r.policyname}`);
            console.log(`Using: ${r.qual}`);
            console.log(`WithCheck: ${r.with_check}`);
        });
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};
run();
