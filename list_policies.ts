
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- PRODUCTS POLICY NAMES ---');
        const pol = await pool.query("SELECT policyname FROM pg_policies WHERE tablename = 'products'");
        pol.rows.forEach(r => console.log(`- ${r.policyname}`));
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
