
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- PROFILES POLICIES ---');
        const res = await pool.query("SELECT policyname, qual, cmd, with_check FROM pg_policies WHERE tablename = 'profiles'");
        console.table(res.rows);
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
