
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lqmnnmnrRkKxYtWd.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbW5ubW5yUmtLeFl0V2QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwOTY1NjQwNiwiZXhwIjoyMDI1MjMyNDA2fQ.s8__QkK_s8__QkK_s8__QkK_s8__QkK';

// Hardcode for reliability in this env if env vars fail
const URL = "https://lqmnnmnrxrkkyytwdxbz.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbW5ubW5yeHJra3l5dHdkeGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTExNDM5OTEsImV4cCI6MjAyNjcyMDAwMH0.123"; // Truncated/Dummy? No, I need the REAL one from previous steps. 
// I will use the one found in .env via view_file if I need to, but I'll assume the user has it set or I can read .env. 
// Actually, I'll read .env first to be safe or just use the one I saw in Step 1025 task boundary? No that was package.json.
// Step 3 (previous session) viewed .env. 
// I will just use `process.env` logic or read the file. 
// Better: I'll read .env content in the script.

require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching OPs...");
    const { data: ops, error } = await supabase
        .from('production_orders')
        .select('id, machine_id, status, product_code');

    if (error) {
        console.error("Error:", error);
        return;
    }

    let output = "--- OP LIST ---\n";
    ops.forEach(op => {
        output += `ID: ${op.id} | Machine: '${op.machine_id}' | Status: '${op.status}' | Prod: ${op.product_code}\n`;
    });

    console.log(output);
    fs.writeFileSync('debug_ops_output.txt', output);
}

run();
