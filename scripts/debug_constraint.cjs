
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ojnrtqejmnssmkgywufa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbnJ0cWVqbW5zc21rZ3l3dWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzQ3MDYsImV4cCI6MjA3OTY1MDcwNn0.ZAWjuazCvo3TeW7JYkZY0_JvGm_nhUyvg39ySDsZua0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    let output = "Inspecting Data...\n";

    // 1. Fetch Machines Sample
    const { data: machines, error: mError } = await supabase.from('machines').select('id, code, organization_id').limit(5);
    if (mError) {
        output += "Machines Error: " + JSON.stringify(mError) + "\n";
    } else {
        output += "--- MACHINES SAMPLE ---\n";
        (machines || []).forEach(m => {
            output += `ID: ${m.id} (Type: ${typeof m.id}), Code: "${m.code}", Org: ${m.organization_id}\n`;
        });
    }

    // 2. Fetch OPs Sample
    const { data: ops, error: oError } = await supabase.from('production_orders').select('id, machine_id, organization_id').limit(5);
    if (oError) {
        output += "OPs Error: " + JSON.stringify(oError) + "\n";
    } else {
        output += "--- OPs SAMPLE ---\n";
        (ops || []).forEach(op => {
            output += `OP ID: ${op.id}, MachineID: "${op.machine_id}", Org: ${op.organization_id}\n`;
        });
    }

    fs.writeFileSync('debug_output.txt', output);
    console.log("Done.");
}

inspect();
