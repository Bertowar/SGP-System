
import { supabase } from './supabaseClient';
import { ProductionEntry, AppAlert, ProductionOrder, MachineStatus, DashboardSummary } from '../types';
import { SYSTEM_OPERATOR_ID } from '../constants';
import { formatError } from './utils';
import { processStockDeduction, processScrapGeneration, processStockTransaction } from './inventoryService';

// Função auxiliar interna para garantir conversão numérica
const ensureNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

// --- Helpers ---

const mapEntryFromDB = (data: any): ProductionEntry => ({
    id: data.id,
    date: data.date,
    shift: data.shift,
    operatorId: data.operator_id,
    productCode: data.product_code,
    machineId: data.machine_id,
    startTime: data.start_time,
    endTime: data.end_time,
    qtyOK: ensureNumber(data.qty_ok),
    qtyDefect: ensureNumber(data.qty_defect),
    scrapReasonId: data.scrap_reason_id,
    observations: data.observations,
    createdAt: Number(data.created_at),
    cycleRate: ensureNumber(data.cycle_rate || data.meta_data?.cycleRate),
    measuredWeight: ensureNumber(data.measured_weight || data.meta_data?.measuredWeight),
    calculatedScrap: ensureNumber(data.calculated_scrap),
    downtimeMinutes: ensureNumber(data.downtime_minutes),
    downtimeTypeId: data.downtime_type_id,
    metaData: data.meta_data || {},
    productionOrderId: data.production_order_id
});

const mapEntryToDB = (entry: ProductionEntry) => ({
    id: entry.id,
    date: entry.date,
    shift: entry.shift || null,
    operator_id: entry.operatorId,
    product_code: entry.productCode || null,
    machine_id: entry.machineId,
    start_time: entry.startTime || null,
    end_time: entry.endTime || null,
    qty_ok: ensureNumber(entry.qtyOK),
    qty_defect: ensureNumber(entry.qtyDefect),
    scrap_reason_id: entry.scrapReasonId || null,
    observations: entry.observations,
    created_at: entry.createdAt,
    cycle_rate: ensureNumber(entry.cycleRate),
    measured_weight: ensureNumber(entry.measuredWeight),
    calculated_scrap: ensureNumber(entry.calculatedScrap),
    downtime_minutes: ensureNumber(entry.downtimeMinutes),
    downtime_type_id: entry.downtimeTypeId || null,
    meta_data: entry.metaData || {},
    production_order_id: entry.productionOrderId || null
});

const mapAlertFromDB = (data: any): AppAlert => ({
    id: data.id,
    type: data.type,
    title: data.title,
    message: data.message,
    severity: data.severity,
    createdAt: Number(data.created_at),
    isRead: data.is_read,
    relatedEntryId: data.related_entry_id
});

const mapAlertToDB = (alert: AppAlert) => ({
    id: alert.id,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    created_at: alert.createdAt,
    is_read: alert.isRead,
    related_entry_id: alert.relatedEntryId
});

// --- Production Entries (CORE) ---


import { getCurrentOrgId } from './auth';

export const saveEntry = async (entry: ProductionEntry): Promise<void> => {
    if (entry.operatorId === SYSTEM_OPERATOR_ID) {
        const { data } = await supabase.from('operators').select('id').eq('id', SYSTEM_OPERATOR_ID).single();
        if (!data) {
            await supabase.from('operators').insert([{ id: SYSTEM_OPERATOR_ID, name: 'SISTEMA (Inativo)' }]);
        }
    }

    // Explicitly add org_id if possible
    const orgId = await getCurrentOrgId();
    const payload = mapEntryToDB(entry);
    if (orgId) {
        (payload as any).organization_id = orgId;
    }

    const { error } = await supabase.from('production_entries').upsert([payload]);
    if (error) throw error;
};

// ... handleQualitySideEffects remains same ...
const handleQualitySideEffects = async (entry: ProductionEntry): Promise<void> => {
    const isDraft = entry.metaData?.is_draft === true;
    if (isDraft || entry.qtyDefect <= 0) return;

    const total = entry.qtyOK + entry.qtyDefect;
    if (total === 0) return;

    const defectRate = entry.qtyDefect / total; // 0.0 to 1.0

    // Fetch Settings manually to avoid circular dependency with storage.ts
    // Use ID 1 for global settings as per masterDataService convention
    const { data: settingsData } = await supabase.from('app_settings').select('*').limit(1).single();

    // Map DB columns to settings object (fallback to defaults if missing)
    const settings = {
        extrusionScrapLimit: settingsData?.extrusion_scrap_limit ?? 5.0,
        thermoformingScrapLimit: settingsData?.thermoforming_scrap_limit ?? 2.0
    };

    // Fetch Machine Sector
    const { data: machine } = await supabase.from('machines').select('sector').eq('code', entry.machineId).single();
    const sector = machine?.sector;

    // Determine Limit (Default 5%)
    let limitPercent = 5;
    let limitSource = 'Padrão';

    if (sector === 'Extrusão' && settings.extrusionScrapLimit) {
        limitPercent = settings.extrusionScrapLimit;
        limitSource = 'Extrusão';
    } else if ((sector === 'Termoformagem' || sector === 'TFs') && settings.thermoformingScrapLimit) {
        limitPercent = settings.thermoformingScrapLimit;
        limitSource = 'TFs';
    }

    const limitRate = limitPercent / 100;

    if (defectRate > limitRate) {
        const alertId = crypto.randomUUID();
        await saveAlert({
            id: alertId,
            type: 'quality',
            title: 'Refugo Alto Detectado',
            message: `Taxa de ${(defectRate * 100).toFixed(1)}% na máquina ${entry.machineId} (Setor: ${sector}). Limite (${limitSource}): ${limitPercent}%`,
            severity: 'high',
            createdAt: Date.now(),
            isRead: false,
            relatedEntryId: entry.id
        });
    }
};

export const registerProductionEntry = async (entry: ProductionEntry, isEditMode: boolean): Promise<void> => {
    const isDraft = entry.metaData?.is_draft === true;
    const wasDraft = entry.metaData?.was_draft === true;
    const shouldDeductStock = (!isEditMode && !isDraft) || (isEditMode && !isDraft && wasDraft);

    const dbEntry = mapEntryToDB(entry);

    // Inject OrgID explicitly
    const orgId = await getCurrentOrgId();
    if (orgId) {
        (dbEntry as any).organization_id = orgId;
    }

    if (entry.operatorId === SYSTEM_OPERATOR_ID) {
        const { data } = await supabase.from('operators').select('id').eq('id', SYSTEM_OPERATOR_ID).single();
        if (!data) await supabase.from('operators').insert([{ id: SYSTEM_OPERATOR_ID, name: 'SISTEMA (Inativo)' }]);
    }

    let rpcSuccess = false;

    try {
        const { error } = await supabase.rpc('register_production_transaction', {
            p_entry_data: dbEntry,
            p_should_deduct_stock: shouldDeductStock
        });

        if (error) {
            console.warn("RPC 'register_production_transaction' failed. Proceeding with legacy client-side fallback.", error);
            rpcSuccess = false;
        } else {
            rpcSuccess = true;
        }
    } catch (e: any) {
        console.warn("RPC Exception. Proceeding with legacy client-side fallback.", e);
        rpcSuccess = false;
    }

    if (!rpcSuccess) {
        await saveEntry(entry);

        if (shouldDeductStock) {
            try {
                await processStockDeduction(entry);
            } catch (stockErr) {
                console.error("Stock deduction failed in fallback mode:", stockErr);
            }
        }
    }

    if (!isDraft && entry.productCode && (entry.qtyOK > 0 || entry.qtyDefect > 0)) {
        await processScrapGeneration(entry);

        // SYNC: Se o produto produzido também estiver cadastrado como Matéria Prima (ex: Intermediário),
        // dar entrada no estoque de Materiais para que possa ser consumido na próxima etapa (BOM).
        if (entry.qtyOK > 0 && entry.productCode) {
            try {
                // Check if material exists with this code (using supabase directly to avoid circular dependency if fetchMaterials was used)
                const { data: matData } = await supabase.from('raw_materials').select('id, name').eq('code', entry.productCode.toString()).single();

                if (matData) {
                    await processStockTransaction({
                        materialId: matData.id,
                        type: 'IN',
                        quantity: entry.qtyOK,
                        notes: `Produção Auto: ${entry.qtyOK}un de ${entry.productCode}`,
                        relatedEntryId: entry.id
                    });
                }
            } catch (syncErr) {
                console.warn("Falha ao sincronizar estoque de produto intermediário:", syncErr);
            }
        }
    }

    await handleQualitySideEffects(entry);
};


export const fetchEntries = async (): Promise<ProductionEntry[]> => {
    try {
        const { data, error } = await supabase.from('production_entries').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return (data || []).map(mapEntryFromDB);
    } catch (e) { return []; }
};

export const fetchEntriesByDate = async (date: string): Promise<ProductionEntry[]> => {
    try {
        const { data, error } = await supabase.from('production_entries').select('*').eq('date', date).order('created_at', { ascending: false });
        if (error) return [];
        return (data || []).map(mapEntryFromDB);
    } catch (e) { return []; }
};

export const deleteEntry = async (id: string): Promise<void> => {
    const { error, count } = await supabase.from('production_entries').delete({ count: 'exact' }).eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error("Falha na exclusão: Permissão Negada (RLS) ou Registro não encontrado.");
};

export const getLastMachineEntry = async (machineId: string, date: string): Promise<ProductionEntry | null> => {
    try {
        const { data, error } = await supabase
            .from('production_entries')
            .select('*')
            .eq('machine_id', machineId)
            .eq('date', date)
            .order('end_time', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return mapEntryFromDB(data);
    } catch { return null; }
};

export const checkTimeOverlap = async (machineId: string, date: string, start: string, end: string, excludeId?: string): Promise<boolean> => {
    try {
        let query = supabase
            .from('production_entries')
            .select('id')
            .eq('machine_id', machineId)
            .eq('date', date)
            .lt('start_time', end)
            .gt('end_time', start);

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data && data.length > 0;
    } catch (e) {
        return false;
    }
};

export const fetchMachineStatuses = async (): Promise<Record<string, MachineStatus>> => {
    try {
        const { data, error } = await supabase
            .from('production_entries')
            .select('machine_id, downtime_minutes, created_at, product_code, meta_data')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error || !data) return {};

        const statusMap: Record<string, MachineStatus> = {};
        const today = new Date().setHours(0, 0, 0, 0);

        data.forEach((entry: any) => {
            if (!statusMap[entry.machine_id]) {
                const entryDate = new Date(Number(entry.created_at));
                const isLongStop = entry.meta_data?.long_stop === true;

                if (isLongStop) {
                    statusMap[entry.machine_id] = { status: 'idle' };
                }
                else if (entryDate.getTime() < (today - 172800000)) {
                    statusMap[entry.machine_id] = { status: 'idle' };
                }
                else if (entry.downtime_minutes > 0) {
                    statusMap[entry.machine_id] = { status: 'stopped' };
                }
                else {
                    statusMap[entry.machine_id] = {
                        status: 'running',
                        productCode: entry.product_code
                    };
                }
            }
        });
        return statusMap;
    } catch (e) { return {}; }
};

export const saveAlert = async (alert: AppAlert): Promise<void> => {
    await supabase.from('alerts').insert([mapAlertToDB(alert)]);
};

export const fetchAlerts = async (): Promise<AppAlert[]> => {
    try {
        const { data } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
        return (data || []).map(mapAlertFromDB);
    } catch (e) { return []; }
};

export const markAlertAsRead = async (id: string): Promise<void> => {
    await supabase.from('alerts').update({ is_read: true }).eq('id', id);
};

export const getUnreadAlertCount = async (): Promise<number> => {
    try {
        const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false);
        return count || 0;
    } catch (e) { return 0; }
};

const LOCAL_OPS_KEY = 'pplast_local_ops';
export const fetchProductionOrders = async (): Promise<ProductionOrder[]> => {
    try {
        const { data: orders, error } = await supabase.from('production_orders').select('*, product:products(*)').order('delivery_date', { ascending: true });
        if (error && error.code === '42P01') {
            const localData = localStorage.getItem(LOCAL_OPS_KEY);
            const parsedOrders = localData ? JSON.parse(localData) : [];
            const { data: allProds } = await supabase.from('products').select('*');
            return parsedOrders.map((o: any) => ({ ...o, product: allProds ? allProds.find((p: any) => p.code === o.productCode) : undefined }));
        }
        if (error) throw error;
        const orderIds = orders.map((o: any) => o.id);
        let summaries: any[] = [];
        try { const { data: sumData } = await supabase.from('production_entries').select('production_order_id, qty_ok').in('production_order_id', orderIds); summaries = sumData || []; } catch (e) { }

        return orders.map((d: any) => {
            const produced = summaries.filter((s: any) => s.production_order_id === d.id).reduce((acc: number, curr: any) => acc + curr.qty_ok, 0);
            return {
                id: d.id,
                productCode: d.product_code,
                machineId: d.machine_id,
                targetQuantity: d.target_quantity,
                producedQuantity: produced,
                customerName: d.customer_name,
                deliveryDate: d.delivery_date,
                status: d.status,
                priority: d.priority,
                notes: d.notes,
                createdAt: d.created_at,
                product: d.product ? {
                    codigo: d.product.code,
                    produto: d.product.name,
                    descricao: d.product.description,
                    pesoLiquido: d.product.net_weight || 0,
                    custoUnit: d.product.unit_cost || 0
                } : undefined,
                metaData: d.meta_data || {}
            }
        });
    } catch (e) { return []; }
};

export const saveProductionOrder = async (order: Partial<ProductionOrder>): Promise<void> => {
    const dbOrder = {
        id: order.id,
        product_code: order.productCode,
        machine_id: order.machineId,
        target_quantity: order.targetQuantity,
        customer_name: order.customerName,
        delivery_date: order.deliveryDate,
        status: order.status,
        priority: order.priority,
        notes: order.notes,
        meta_data: order.metaData || null
    };

    let { error } = await supabase.from('production_orders').upsert([dbOrder]);

    if (error && (error.code === 'PGRST204' || error.message.includes('meta_data'))) {
        console.warn("Aviso: Coluna 'meta_data' não encontrada na tabela 'production_orders'. Salvando versão legada.");
        delete dbOrder.meta_data;
        const retry = await supabase.from('production_orders').upsert([dbOrder]);
        if (retry.error) throw retry.error;
    } else if (error) {
        if (error.code === '42P01') {
            const localData = localStorage.getItem(LOCAL_OPS_KEY);
            const orders = localData ? JSON.parse(localData) : [];
            const existingIdx = orders.findIndex((o: any) => o.id === order.id);
            const newOrderObj = { ...order, createdAt: new Date().toISOString() };
            if (existingIdx >= 0) { orders[existingIdx] = { ...orders[existingIdx], ...newOrderObj }; } else { orders.push(newOrderObj); }
            localStorage.setItem(LOCAL_OPS_KEY, JSON.stringify(orders));
            return;
        }
        throw error;
    }
};

export const deleteProductionOrder = async (id: string): Promise<void> => {
    let linkedCount = 0;
    try {
        const { count, error } = await supabase.from('production_entries').select('id', { count: 'exact', head: true }).eq('production_order_id', id);
        if (!error && count) {
            linkedCount = count;
        }
    } catch (e) {
        console.warn("Skipping pre-check for linked entries due to query error", e);
    }

    if (linkedCount > 0) {
        throw new Error("Não é possível excluir OP com apontamentos vinculados.");
    }

    const { error } = await supabase.from('production_orders').delete().eq('id', id);

    if (error) {
        if (error.code === '42P01') {
            const localData = localStorage.getItem(LOCAL_OPS_KEY);
            if (localData) {
                const orders = JSON.parse(localData);
                const filtered = orders.filter((o: any) => o.id !== id);
                localStorage.setItem(LOCAL_OPS_KEY, JSON.stringify(filtered));
            }
            return;
        }
        if (error.code === '23503') {
            throw new Error("Não é possível excluir OP com apontamentos vinculados (Restrição de Integridade).");
        }
        throw error;
    }
};

export const fetchDashboardStats = async (startDate: string, endDate: string): Promise<DashboardSummary | null> => {
    try {
        const { data, error } = await supabase.rpc('get_dashboard_metrics', {
            p_start_date: startDate,
            p_end_date: endDate
        });

        if (error) {
            console.error("Dashboard RPC Error FULL:", JSON.stringify(error, null, 2));
            throw error;
        }

        return data as DashboardSummary;
    } catch (e) {
        console.error("Dashboard fetch error:", e);
        throw e;
    }
};
