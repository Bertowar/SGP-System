
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query(`
            SELECT 
                tc.table_name, 
                tc.constraint_name, 
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
              AND tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
        `);

        const constraints = {};
        res.rows.forEach(r => {
            const key = `${r.table_name}|${r.constraint_name}|${r.constraint_type}`;
            if (!constraints[key]) constraints[key] = [];
            constraints[key].push(r.column_name);
        });

        let output = '--- SUSPICIOUS CONSTRAINTS ---\n';
        Object.keys(constraints).forEach(k => {
            const [table, name, type] = k.split('|');
            const cols = constraints[k];
            const isSuspicious = cols.length === 1 && (cols[0] === 'code' || cols[0] === 'name');

            if (isSuspicious) {
                output += `Table: ${table}, Constraint: ${name} (${type}), Columns: ${cols.join(', ')}\n`;
            }
        });

        fs.writeFileSync('isolation_report.txt', output);
        console.log("Report written to isolation_report.txt");

    } catch (e) {
        console.error("ERROR EXECUTION:", e);
    } finally {
        await pool.end();
    }
};
run();
