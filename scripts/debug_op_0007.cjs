
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const opId = 'OP-2026-0007';
    console.log(`Fetching details for ${opId}...`);

    // 1. Fetch OP
    const { data: op, error } = await supabase
        .from('production_orders')
        .select('*, product:products(*)')
        .eq('id', opId)
        .single();

    if (error) {
        console.error("Error fetching OP:", error);
        return;
    }

    console.log(`OP Found: ${op.id} | Product: ${op.product_code} (${op.product?.produto}) | Status: ${op.status}`);
    console.log(`Machine: ${op.machine_id}`);

    // 2. Fetch Steps
    const { data: steps, error: errSteps } = await supabase
        .from('production_order_steps')
        .select('*, step:route_steps(*)')
        .eq('production_order_id', opId);

    if (errSteps) console.error("Error fetching steps:", errSteps);

    console.log("\n--- STEPS ---");
    if (steps && steps.length > 0) {
        steps.forEach(s => {
            console.log(`ID: ${s.id} | StepID: ${s.step_id} | Status: ${s.status} | Qty: ${s.qty_planned}`);
            if (s.step) {
                console.log(`  -> Route Step: Order ${s.step.step_order} | MachineGroup: ${s.step.machine_group_id}`);
            } else {
                console.log("  -> NO LINKED ROUTE STEP FOUND (Or Join Failed)");
            }
        });
    } else {
        console.log("NO STEPS FOUND FOR THIS OP.");
    }

    // 3. Fetch Route for Product
    // Check if product has a route
    const { data: route } = await supabase
        .from('product_routes')
        .select('*, steps:route_steps(*)')
        .eq('product_id', op.product?.id || '') // Assuming product join has ID
        // Note: op.product might be null if join failed or product missing, but assumed present
        .eq('active', true)
        .single();

    console.log("\n--- ACTIVE ROUTE FOR PRODUCT ---");
    if (route) {
        console.log(`Route ID: ${route.id} | Version: ${route.version}`);
        route.steps.forEach(s => {
            console.log(`  Step: ${s.step_order} | MachineGroup: ${s.machine_group_id} | Cycle: ${s.cycle_time}`);
        });
    } else {
        console.log("NO ACTIVE ROUTE FOUND FOR PRODUCT.");
        // Try fetching by product_code if product_id is not what we link on?
        // Usually routes link to product ID.
    }

    fs.writeFileSync('debug_op_0007.txt', JSON.stringify({ op, steps, route }, null, 2));
}

run();
