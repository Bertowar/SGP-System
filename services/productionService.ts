
import { supabase } from './supabaseClient';
import { getCurrentOrgId } from './auth';
import { ProductionOrder, Product, MaterialReservation, WorkOrder, AppAlert, OrderStatusHistory, ProductionOrderStatus } from '../types';
import { fetchProductRoute, calculateMRP } from './inventoryService';
import { formatError } from './utils';

/**
 * Grava a mudança de status no histórico de auditoria.
 */
export const recordStatusHistory = async (orderId: string, from: string, to: string) => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return;

    try {
        const { error } = await supabase
            .from('order_status_history')
            .insert([{
                order_id: orderId,
                previous_status: from,
                new_status: to,
                organization_id: orgId,
            }]);

        if (error) console.error("Erro ao gravar histórico de status:", error);
    } catch (e) {
        console.error("Exceção ao gravar histórico:", e);
    }
};

/**
 * Busca o histórico de status de uma OP.
 */
export const fetchStatusHistory = async (orderId: string): Promise<OrderStatusHistory[]> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return [];

    const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .eq('organization_id', orgId)
        .order('changed_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar histórico de status:", error);
        return [];
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        orderId: d.order_id,
        previousStatus: d.previous_status,
        newStatus: d.new_status,
        changedBy: d.changed_by,
        changedAt: d.changed_at
    }));
};

// DTO for Creating Production Order
interface CreateProductionOrderDTO {
    productCode: string; // Or ID if we have it
    quantity: number;
    deliveryDate?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    salesOrderId?: string;
    notes?: string;
    machineId?: string; // Preferred Machine
    parentOrderId?: string; // For Recursive MRP
    mrpPlan?: any; // MRPPlanItem (Typed as any to avoid circular import issues if types.ts not updated yet, but we updated it)
}

export const createProductionOrder = async (dto: CreateProductionOrderDTO): Promise<ProductionOrder> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) throw new Error("Organização não identificada.");

    // 1. Fetch Product ID and Info
    const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', orgId)
        .eq('code', dto.productCode)
        .limit(1)
        .single();

    if (productError || !productData) {
        console.error("Erro busca produto:", productError, "Code:", dto.productCode);
        throw new Error(`Produto ${dto.productCode} não encontrado ou duplicado.`);
    }
    const product = productData as Product;
    // We need the internal UUID 'id' for relationships
    if (!product.id) throw new Error("Produto sem ID interno (UUID).");

    // 2. Fetch Active Route (Roteiro)
    const route = await fetchProductRoute(product.id);
    if (!route) {
        // Warning: Allowing OP without Route? PRD implies Automation.
        // For now, let's allow but we can't create Steps.
        console.warn("Roteiro não encontrado para o produto.");
    }

    // 3. Fetch Active BOM (Lista de Materiais) - Optional Check / Optimization
    // Assuming calculateMRP will handle BOM explosion logic later.
    // We removed the manual legacy fetch here to avoid confusion with new structure.

    // --- TRANSACTION START (Virtual) ---
    // Supabase JS doesn't support complex Transactions easily on client side yet without RPC.
    // We will do sequential inserts and rollback manually on error if needed, 
    // or trust the "Happy Path" for this MVP step.

    // A. Insert Production Order Header
    // const newOpId = crypto.randomUUID(); // Removed: DB generates ID via Sequence now
    const { data: opData, error: opError } = await supabase
        .from('production_orders')
        .insert({
            // id: newOpId, // Let DB default (Sequence) handle it
            organization_id: orgId,
            product_code: dto.productCode, // Legacy field
            // product_id: product.id, // Future field if we migrate fully
            target_quantity: dto.quantity,
            delivery_date: dto.deliveryDate,
            priority: dto.priority || 'NORMAL',
            status: 'PLANNED', // Default to Planned/Pending until confirmed/started
            route_id: route?.id || null,
            sales_order_id: dto.salesOrderId || null,
            notes: dto.notes,
            machine_id: dto.machineId || null,
            parent_order_id: dto.parentOrderId || null
        })
        .select()
        .single();

    if (opError || !opData) throw new Error("Erro ao criar Ordem de Produção: " + formatError(opError));
    const newOP = opData as ProductionOrder;

    // B. Explode BOM -> Material Reservations (RF5) & Recursive Child OPs (MRP Multi-level)
    // STRATEGY: Use calculateMRP to get the plan, then execute it.

    // 1. Get Plan (Use provided or Calculate)
    let plan = dto.mrpPlan;
    if (!plan) {
        // Auto-calculate if not provided
        plan = await calculateMRP(product.id, dto.quantity);
    }

    // 2. Process Children (Components/Intermediates)
    if (plan && plan.children && plan.children.length > 0) {
        const reservations = [];

        for (const child of plan.children) {
            // 2.1 Create Reservation (Always needed for the Parent to consume)
            // We need the material_id. In MRPPlanItem we store productId (if product) or... 
            // we need to resolve Material ID.
            // The MRPPlanItem has 'productCode'. We need to find the raw_material ID.
            // Optimize: calculateMRP should return IDs? It does: 'productId' and 'id'. 
            // But for Raw Materials, 'productId' might be empty.
            // We need to look up raw_material ID by code if missing.

            let materialId = child.productId; // Try product ID first
            if (!materialId || materialId.length < 10) { // If empty or short
                const { data: matData } = await supabase.from('raw_materials').select('id').eq('code', child.productCode).single();
                if (matData) materialId = matData.id;
            }

            if (materialId) {
                reservations.push({
                    organization_id: orgId,
                    production_order_id: newOP.id,
                    material_id: materialId,
                    quantity: child.requiredQty, // Gross Requirement for this OP
                    status: 'PENDING'
                });
            }

            // 2.2 Recursion: Create Sub-OP if Action is PRODUCE
            if (child.action === 'PRODUCE') {
                console.log(`[MRP] Creating Sub-OP for ${child.name} (Parent: ${newOP.id})`);
                await createProductionOrder({
                    productCode: child.productCode,
                    quantity: child.netRequirement, // Produce the NET amount needed
                    deliveryDate: dto.deliveryDate,
                    priority: dto.priority,
                    notes: `Sub-OP (MRP) para OP #${newOP.id.substring(0, 8)}`,
                    parentOrderId: newOP.id,
                    salesOrderId: dto.salesOrderId,
                    mrpPlan: child // Pass the child plan to avoid re-calculation
                });
            }
        }

        if (reservations.length > 0) {
            const { error: resError } = await supabase.from('material_reservations').insert(reservations);
            if (resError) console.error("Erro ao criar reservas:", resError);
        }
    }

    // C. Explode Route -> Work Orders (RF3/RF4)
    if (route && route.steps && route.steps.length > 0) {
        const workOrders = route.steps.map((step, index) => ({
            organization_id: orgId,
            production_order_id: newOP.id,
            step_id: step.id,
            // machine_id: null, // To be assigned later or auto-assigned from group
            status: index === 0 ? 'READY' : 'PENDING', // First step is Ready
            qty_planned: dto.quantity, // Full lot for now
            qty_produced: 0,
            qty_rejected: 0
        }));

        const { error: woError } = await supabase
            .from('production_order_steps')
            .insert(workOrders);

        if (woError) console.error("Erro ao gerar Ordens de Trabalho:", woError);
    }

    return newOP;
};

export const getUnreadAlertCount = async (): Promise<number> => {
    try {
        const orgId = await getCurrentOrgId();
        const { count, error } = await supabase
            .from('app_alerts')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('is_read', false);
        return count || 0;
    } catch (e) { return 0; }
};

export const fetchAlerts = async (): Promise<AppAlert[]> => {
    try {
        const orgId = await getCurrentOrgId();
        const { data, error } = await supabase
            .from('app_alerts')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return (data || []).map((d: any) => ({
            id: d.id,
            type: d.type,
            title: d.title,
            message: d.message,
            severity: d.severity,
            createdAt: new Date(d.created_at).getTime(),
            isRead: d.is_read,
            relatedEntryId: d.related_entry_id
        }));
    } catch (e) { return []; }
};

export const markAlertAsRead = async (id: string): Promise<void> => {
    await supabase.from('app_alerts').update({ is_read: true }).eq('id', id);
};

// Function to fetch full OP details (with steps and reservations)
export const fetchProductionOrderDetails = async (opId: string) => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return null;

    const { data, error } = await supabase
        .from('production_orders')
        .select(`
            *,
            product:products(name, description, code),
            reservations:material_reservations(
                *,
                material:raw_materials(name, unit, code)
            ),
            steps:production_order_steps(
                *,
                step:route_steps(*)
            )
        `)
        .eq('id', opId)
        .eq('organization_id', orgId)
        .single();

    if (error || !data) return null;

    // Resolve machine_id mechanism:
    // If DB stores Code (e.g. "EXT-01") but UI expects UUID, we must fetch the UUID.
    let resolvedMachineId = data.machine_id;
    if (data.machine_id && data.machine_id.length < 32) { // heuristic: UUID is 36 chars
        const { data: mData } = await supabase
            .from('machines')
            .select('id')
            .eq('organization_id', orgId)
            .eq('code', data.machine_id) // Match the stored Code
            .single();
        if (mData) {
            resolvedMachineId = mData.id;
        }
    }

    // Map snake_case to CamelCase
    return {
        id: data.id,
        organizationId: data.organization_id,
        machineId: resolvedMachineId, // Fix: Ensure machineId is mapped so UI knows current state
        productCode: data.product_code,
        targetQuantity: data.target_quantity,
        producedQuantity: data.produced_quantity || 0,
        deliveryDate: data.delivery_date,
        priority: data.priority,
        status: data.status,

        note: data.notes,
        parentOrderId: data.parent_order_id, // Map Parent Link
        product: data.product ? {
            produto: data.product.name,
            codigo: data.product.code,
            descricao: data.product.description
        } : undefined,

        // Fix: Add product join and map everything.
        reservations: data.reservations?.map((r: any) => ({
            id: r.id,
            materialId: r.material_id,
            quantity: r.quantity,
            status: r.status,
            material: r.material // { name, unit, code }
        })),
        steps: data.steps?.map((s: any) => ({
            id: s.id,
            stepId: s.step_id,
            status: s.status,
            qtyPlanned: s.qty_planned,
            qtyProduced: s.qty_produced,
            qtyRejected: s.qty_rejected,
            startTime: s.start_time,
            endTime: s.end_time,
            step: s.step ? {
                description: s.step.description,
                setupTime: s.step.setup_time,
                cycleTime: s.step.cycle_time,
                stepOrder: s.step.step_order
            } : {},
            machine: s.machine, // null for now
            operator: s.operator // null for now
        }))
    };
};

// --- LEGACY / SIMPLE CRUD SUPPORT (For ProductionPlanPage compatibility) ---

export const fetchProductionOrders = async (): Promise<ProductionOrder[]> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return [];
    const { data, error } = await supabase
        .from('production_orders')
        .select('*, product:products(*)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
    if (error) return [];

    // Map data to ensure types match if needed, or cast
    return (data || []).map((d: any) => ({
        ...d,
        productCode: d.product_code, // DB uses product_code
        targetQuantity: d.target_quantity,
        producedQuantity: d.produced_quantity,
        deliveryDate: d.delivery_date,
        machineId: d.machine_id,
        salesOrderId: d.sales_order_id,
        routeId: d.route_id,
        bomId: d.bom_id,
        metaData: d.meta_data,
        createdAt: d.created_at,
        parentOrderId: d.parent_order_id // Map DB snake_case to TS camelCase
        // product is joined
    } as ProductionOrder));
};

export const saveProductionOrder = async (order: Partial<ProductionOrder>): Promise<string> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) throw new Error("Organização não identificada.");

    // Build payload dynamically
    const dbOrder: any = {};

    if (order.productCode !== undefined) dbOrder.product_code = order.productCode;
    if (order.targetQuantity !== undefined) dbOrder.target_quantity = order.targetQuantity;
    if (order.deliveryDate !== undefined) dbOrder.delivery_date = order.deliveryDate;
    if (order.priority !== undefined) dbOrder.priority = order.priority;
    if (order.status !== undefined) dbOrder.status = order.status;
    if (order.notes !== undefined) dbOrder.notes = order.notes;
    // machineId can be null (to unassign), but if undefined, don't update
    if (order.machineId !== undefined) dbOrder.machine_id = order.machineId;
    if (order.metaData !== undefined) dbOrder.meta_data = order.metaData;

    if (order.id) {
        // --- AUDIT TRAIL LOGIC ---
        if (order.status !== undefined) {
            // 1. Fetch current status to check if it's changing
            const { data: currentOrder } = await supabase
                .from('production_orders')
                .select('status')
                .eq('id', order.id)
                .single();

            if (currentOrder && currentOrder.status !== order.status) {
                await recordStatusHistory(order.id, currentOrder.status, order.status);
            }
        }

        // UPDATE STRATEGY - REVISED (Code First):
        // Evidence shows DB stores Machine CODE ("EXT-01") in machine_id column.
        // But UI sends UUID.
        // 1. Resolve UUID -> Code.
        // 2. Try saving Code (Trimmed).
        // 3. If fails, Try saving UUID (Fallback).

        // Fetch Machine Details unconditionally if machineId is present
        let machineData: any = null;
        if (dbOrder.machine_id) {
            // Check if it looks like UUID? Or just fetch by ID.
            const { data } = await supabase.from('machines').select('code, organization_id').eq('id', dbOrder.machine_id).single();
            machineData = data;
        }

        // Prepare Base Payload
        const baseUpdate = { ...dbOrder };
        delete baseUpdate.organization_id; // Default: Don't touch Org

        // STRATEGY 1: CODE (Most likely correct based on data inspection)
        if (machineData && machineData.code) {
            const codePayload = {
                ...baseUpdate,
                machine_id: machineData.code.trim(),
                organization_id: machineData.organization_id // Force sync Org just in case
            };
            try {
                const { error } = await supabase.from('production_orders').update(codePayload).eq('id', order.id);
                if (!error) return order.id;
                console.warn("Strategy 1 (Code) failed:", error.message);
            } catch (e) { console.warn("Strategy 1 Exception:", e); }
        }

        // STRATEGY 2: UUID (Fallback if DB expects UUID)
        try {
            // Restore UUID if we tried Code
            const uuidPayload = { ...baseUpdate };
            // If we have machineData, sync org too?
            if (machineData) uuidPayload.organization_id = machineData.organization_id;

            const { error } = await supabase.from('production_orders').update(uuidPayload).eq('id', order.id);
            if (!error) return order.id;

            console.warn("Strategy 2 (UUID+Org) failed:", error.message);
            // If that failed, maybe UUID without Org?
            delete uuidPayload.organization_id;
            const { error: err3 } = await supabase.from('production_orders').update(uuidPayload).eq('id', order.id);
            if (!err3) return order.id;
            throw err3; // Fail finally
        } catch (errFinal: any) {
            console.error("All strategies failed. Last error:", errFinal.message);
            throw errFinal;
        }
    } else {
        // INSERT: Must include organization_id
        dbOrder.organization_id = orgId;

        // Ensure required fields are present (though DB constraints will catch this too)
        const { data, error } = await supabase.from('production_orders').insert(dbOrder).select('id').single();
        if (error) throw error;
        return data.id;
    }
};

export const deleteProductionOrder = async (id: string): Promise<void> => {
    // 1. Manually Cascade Delete Linked Entries (production_entries)
    const { error: entriesError } = await supabase
        .from('production_entries')
        .delete()
        .eq('production_order_id', id);

    if (entriesError) {
        console.error("Error cleaning up linked entries:", entriesError);
        throw entriesError;
    }

    // 2. Cascade Delete Linked Reservations (material_reservations)
    // Sometimes FKs here also block delete
    const { error: resError } = await supabase
        .from('material_reservations')
        .delete()
        .eq('production_order_id', id);

    if (resError) {
        console.error("Error cleaning up reservations:", resError);
        // Continue? If reservations block, we should probably throw.
        // throw resError; 
    }

    // 3. Delete the OP itself
    const { error } = await supabase.from('production_orders').delete().eq('id', id);
    if (error) throw error;
};

// --- PRODUCTION ENTRY MANAGEMENT (Apontamentos) ---

export const fetchEntriesByDate = async (date: string): Promise<any[]> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return [];

    const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .eq('organization_id', orgId)
        .eq('date', date)
        .order('start_time', { ascending: false });

    if (error) {
        console.error("Error fetching entries:", error);
        return [];
    }

    // Map Snake_Case DB to CamelCase TS
    return (data || []).map((d: any) => ({
        id: d.id,
        date: d.date,
        startTime: d.start_time,
        endTime: d.end_time,
        machineId: d.machine_id,
        operatorId: d.operator_id,
        productCode: d.product_code,
        qtyOK: d.qty_ok,
        qtyDefect: d.qty_defect,
        downtimeMinutes: d.downtime_minutes || 0,
        downtimeTypeId: d.downtime_type_id,
        observations: d.observations,
        shift: d.shift,
        scrapReasonId: d.scrap_reason_id,
        productionOrderId: d.production_order_id,
        cycleRate: d.cycle_rate, // If column exists
        measuredWeight: d.measured_weight, // If column exists
        metaData: d.meta_data,
        createdAt: d.created_at
    }));
};

export const fetchEntriesByProductionOrderId = async (opId: string): Promise<any[]> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return [];

    // 1. Fetch entries (without failing joins for missing FKs)
    const { data: entries, error } = await supabase
        .from('production_entries')
        .select('*, scrap_reason:scrap_reasons(description)') // scrap_reason has FK, so this is safe
        .eq('organization_id', orgId)
        .eq('production_order_id', opId)
        .order('start_time', { ascending: false });

    if (error) {
        console.error("Error fetching entries by OP:", error);
        return [{ id: 'error', error: error.message }];
    }

    if (!entries || entries.length === 0) return [];

    // 2. Manual Join for Operators and Downtime Types (Missing FKs in DB)
    const operatorIds = [...new Set(entries.map(e => e.operator_id).filter(Boolean))];
    const downtimeTypeIds = [...new Set(entries.map(e => e.downtime_type_id).filter(Boolean))];

    const [operatorsRes, downtimeTypesRes] = await Promise.all([
        operatorIds.length > 0 ? supabase.from('operators').select('id, name').in('id', operatorIds) : { data: [] },
        downtimeTypeIds.length > 0 ? supabase.from('downtime_types').select('id, description').in('id', downtimeTypeIds) : { data: [] }
    ]);

    const operatorMap = (operatorsRes.data || []).reduce((acc: any, op: any) => ({ ...acc, [op.id]: op }), {});
    const downtimeMap = (downtimeTypesRes.data || []).reduce((acc: any, dt: any) => ({ ...acc, [dt.id]: dt }), {});

    // 3. Merge Data
    return entries.map((d: any) => ({
        id: d.id,
        date: d.date,
        startTime: d.start_time,
        endTime: d.end_time,
        machineId: d.machine_id,
        operatorId: d.operator_id,
        operatorName: operatorMap[d.operator_id]?.name || null, // Mapped locally
        productCode: d.product_code,
        qtyOK: d.qty_ok, // Production
        qtyNOK: d.qty_defect, // Scrap (Defect)
        downtimeMinutes: d.downtime_minutes || 0,
        downtimeTypeId: d.downtime_type_id,
        downtimeTypeName: downtimeMap[d.downtime_type_id]?.description || null, // Mapped locally
        observations: d.observations,
        shift: d.shift,
        scrapReasonId: d.scrap_reason_id,
        scrapReasonName: d.scrap_reason?.description || null, // Native join
        productionOrderId: d.production_order_id,
        createdAt: d.created_at,
        measuredWeight: d.measured_weight,
        metaData: d.meta_data,
        cycleRate: d.cycle_rate
    }));
};

export const deleteEntry = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('production_entries')
        .delete()
        .eq('id', id);
    if (error) throw error;
};
export const fetchActiveProductionOrders = async (): Promise<ProductionOrder[]> => {
    const orgId = await getCurrentOrgId();
    if (!orgId) return [];

    const { data, error } = await supabase
        .from('production_orders')
        .select(`
            id, product_code, status, delivery_date, target_quantity, machine_id, produced_quantity, priority, created_at,
            product:products(id, codigo, produto, type, description, unit),
            work_orders(id, machine_id, cycle_time, qty_planned, qty_produced, status, step_order)
        `)
        .eq('organization_id', orgId)
        .in('status', ['PLANNED', 'CONFIRMED', 'IN_PROGRESS']); // Only active ones

    if (error) {
        console.error("Error fetching OPs ativas:", error);
        return [];
    }

    // Map snake to camel
    return (data || []).map((o: any) => ({
        id: o.id,
        productCode: o.product_code,
        status: o.status,
        deliveryDate: o.delivery_date,
        targetQuantity: o.target_quantity,
        producedQuantity: o.produced_quantity || 0,
        machineId: o.machine_id,
        priority: o.priority,
        createdAt: o.created_at,
        product: o.product,
        workOrders: o.work_orders?.map((w: any) => ({
            id: w.id,
            machineId: w.machine_id,
            cycleTime: w.cycle_time,
            qtyPlanned: w.qty_planned,
            qtyProduced: w.qty_produced,
            status: w.status
        })) || []
    }));
};
