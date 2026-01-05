const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\berto\\DEV\\SGP-System\\.env' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    await client.connect();
    let output = 'DEBUG START FILE\n';

    const ops = await client.query("SELECT id, product_code FROM production_orders WHERE machine_id = 'EXT-02' ORDER BY created_at DESC LIMIT 3");
    output += `OPS_COUNT: ${ops.rows.length}\n`;
    ops.rows.forEach(op => output += `OP_ITEM: ${JSON.stringify(op)}\n`);

    const specificOp = await client.query("SELECT id, production_order_id, operator_id, organization_id, qty_ok, measured_weight FROM production_entries WHERE production_order_id = 'OP-2026-0014'");
    output += `SPECIFIC_OP_SEARCH: ${specificOp.rows.length}\n`;
    specificOp.rows.forEach(e => output += `FOUND: ${JSON.stringify(e)}\n`);

    fs.writeFileSync('debug_output.txt', output);
    await client.end();
}

run();
