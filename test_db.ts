
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.argv[2];

if (!connectionString) {
    console.error('Please provide connection string as argument');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000 // Identificar falha rápido
});

console.log('Testing connection...');

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection FAILED:', err.message);
        process.exit(1);
    } else {
        console.log('Connection SUCCESS! Server time:', res.rows[0].now);
        process.exit(0);
    }
});
