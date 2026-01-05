
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const opId = 'OP-2026-0010';
    let outputLogs = "";
    function log(msg) {
        console.log(msg);
        outputLogs += msg + "\n";
    }

    try {
        log(`Fetching details for ${opId}...`);

        // 1. List recent OPs to help debug if 0010 is wrong
        const { data: recentOps, error: recentError } = await supabase.from('production_orders').select('id, product_code').order('created_at', { ascending: false }).limit(5);
        log("Recent OPs: " + JSON.stringify(recentOps));
        if (recentError) log("Recent Error: " + JSON.stringify(recentError));

        // 2. Fetch Target OP
        const { data: op, error } = await supabase
            .from('production_orders')
            .select('*, product:products(*)')
            .eq('id', opId)
            .maybeSingle();

        if (error) {
            log("Error fetching OP: " + JSON.stringify(error));
        } else if (!op) {
            log("OP Not Found: " + opId);
        } else {
            log(`OP Found: ${op.id} | Product: ${op.product_code} (${op.product?.produto || 'N/A'})`);

            // 3. Fetch OP Steps
            const { data: opSteps } = await supabase
                .from('production_order_steps')
                .select('*')
                .eq('production_order_id', opId)
                .order('step_order');

            log(`\n--- OP ACTUAL STEPS (${opSteps?.length || 0}) ---`);
            (opSteps || []).forEach(s => {
                log(`ID: ${s.id} | StepID: ${s.step_id} | Status: ${s.status} | Qty: ${s.qty_planned} | Order: ${s.step_order}`);
            });

            // 4. Fetch Source Route Steps
            if (op.product?.id) {
                log(`\n--- SOURCE ROUTE FOR PRODUCT ID ${op.product.id} ---`);
                const { data: route } = await supabase
                    .from('product_routes')
                    .select('*, steps:route_steps(*)')
                    .eq('product_id', op.product.id)
                    .eq('active', true)
                    .single();

                if (route) {
                    log(`Route ID: ${route.id}`);
                    (route.steps || []).sort((a, b) => a.step_order - b.step_order).forEach(s => {
                        log(`  Step Order: ${s.step_order} | Description: ${s.description} | MachineGroup: ${s.machine_group_id} | Cycle: ${s.cycle_time}`);
                    });
                } else {
                    log("No active route found for this product.");
                }
            }
        }
    } catch (err) {
        log("CRASH: " + err.message + "\n" + err.stack);
    } finally {
        fs.writeFileSync('debug_op_0010_out.txt', outputLogs);
    }
}

run();
