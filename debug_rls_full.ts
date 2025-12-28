
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- PRODUCTS POLICIES (FULL) ---');
        const pol = await pool.query("SELECT policyname, qual FROM pg_policies WHERE tablename = 'products'");
        pol.rows.forEach(r => {
            console.log(`POLICY: ${r.policyname}`);
            console.log(`QUAL:   ${r.qual}`);
            console.log('-----------------------------------');
        });
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
