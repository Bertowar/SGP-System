
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid
                                 AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = 'public.raw_materials'::regclass
            AND    i.indisprimary;
        `);
        console.log('PK COLUMNS:', JSON.stringify(res.rows));
    } catch (e) {
        console.error("ERROR EXECUTION:", e);
    } finally {
        await pool.end();
    }
};
run();
