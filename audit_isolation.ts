
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const runAudit = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- Tables WITHOUT organization_id ---');
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
              AND table_name NOT IN (
                  SELECT table_name 
                  FROM information_schema.columns 
                  WHERE column_name = 'organization_id' 
                    AND table_schema = 'public'
              )
            ORDER BY table_name;
        `);
        console.table(res.rows);
    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
runAudit();
