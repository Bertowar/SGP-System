
import { supabase } from './supabaseClient';
import { RawMaterial, ProductBOM, InventoryTransaction, Supplier, PurchaseOrder, PurchaseOrderItem, ShippingOrder, ShippingItem, ProductCostSummary, ProductionEntry } from '../types';
import { formatError } from './utils';

// --- INVENTORY & BOM ---

export const fetchMaterials = async (): Promise<RawMaterial[]> => {
    try {
        const { data, error } = await supabase.from('raw_materials').select('*').order('name');
        if (error) return [];
        return data.map((d: any) => ({
            id: d.id,
            code: d.code,
            name: d.name,
            unit: d.unit,
            currentStock: d.current_stock,
            minStock: d.min_stock,
            unitCost: d.unit_cost,
            category: d.category || 'raw_material',
            group: d.group_name || 'Diversos'
        }));
    } catch (e) { return []; }
};

export const saveMaterial = async (mat: RawMaterial): Promise<void> => {
    const dbMat = {
        code: mat.code,
        name: mat.name,
        unit: mat.unit,
        current_stock: mat.currentStock,
        min_stock: mat.minStock,
        unit_cost: mat.unitCost,
        category: mat.category,
        group_name: mat.group
    };

    const payload = mat.id ? { ...dbMat, id: mat.id } : dbMat;
    const { error } = await supabase.from('raw_materials').upsert([payload], { onConflict: 'code' });

    if (error) {
        console.warn("Possible missing column 'group_name'. Retrying with legacy schema.");
        const legacyPayload = { ...payload };
        delete (legacyPayload as any).group_name;
        const { error: legacyError } = await supabase.from('raw_materials').upsert([legacyPayload], { onConflict: 'code' });
        if (legacyError) throw legacyError;
    }
};

export const renameMaterialGroup = async (oldName: string, newName: string): Promise<void> => {
    if (!oldName || !newName) return;
    await supabase.from('raw_materials').update({ group_name: newName }).eq('group_name', oldName);
};

export const deleteMaterial = async (id: string): Promise<void> => {
    await supabase.from('raw_materials').delete().eq('id', id);
};

export const fetchBOM = async (productCode: number): Promise<ProductBOM[]> => {
    try {
        const { data, error } = await supabase.from('product_bom').select('*, material:raw_materials(*)').eq('product_code', productCode);
        if (error) return [];
        return data.map((d: any) => ({
            id: d.id, productCode: d.product_code, materialId: d.material_id, quantityRequired: d.quantity_required,
            material: d.material ? { id: d.material.id, code: d.material.code, name: d.material.name, unit: d.material.unit, currentStock: d.material.current_stock, minStock: d.material.min_stock, unitCost: d.material.unit_cost, category: d.material.category, group: d.material.group_name } : undefined
        }));
    } catch (e) { return []; }
};

export const fetchAllBOMs = async (): Promise<ProductBOM[]> => {
    try {
        const { data, error } = await supabase.from('product_bom').select('*, material:raw_materials(*)');
        if (error) return [];
        return data.map((d: any) => ({
            id: d.id, productCode: d.product_code, materialId: d.material_id, quantityRequired: d.quantity_required,
            material: d.material ? { id: d.material.id, code: d.material.code, name: d.material.name, unit: d.material.unit, currentStock: d.material.current_stock, minStock: d.material.min_stock, unitCost: d.material.unit_cost, category: d.material.category, group: d.material.group_name } : undefined
        }));
    } catch (e) { return []; }
};

export const saveBOM = async (bom: Omit<ProductBOM, 'material'>): Promise<void> => {
    if (bom.id) await supabase.from('product_bom').update({ quantity_required: bom.quantityRequired }).eq('id', bom.id);
    else await supabase.from('product_bom').insert([{ product_code: bom.productCode, material_id: bom.materialId, quantity_required: bom.quantityRequired }]);
};

export const deleteBOMItem = async (id: string): Promise<void> => {
    await supabase.from('product_bom').delete().eq('id', id);
};

// --- Outras funções de Compras e Logística mantidas ---

export const fetchSuppliers = async (): Promise<Supplier[]> => {
    try {
        const { data, error } = await supabase.from('suppliers').select('*').order('name');
        return (data || []).map((d: any) => ({ id: d.id, name: d.name, contactName: d.contact_name, email: d.email, phone: d.phone }));
    } catch (e) { return []; }
};
export const saveSupplier = async (supplier: Supplier): Promise<void> => {
    const dbSup = { name: supplier.name, contact_name: supplier.contactName, email: supplier.email, phone: supplier.phone };
    if (supplier.id) await supabase.from('suppliers').update(dbSup).eq('id', supplier.id);
    else await supabase.from('suppliers').insert([dbSup]);
};
export const deleteSupplier = async (id: string): Promise<void> => { await supabase.from('suppliers').delete().eq('id', id); };

export const fetchPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    try {
        const { data, error } = await supabase.from('purchase_orders').select('*, supplier:suppliers(*)').order('created_at', { ascending: false });
        return (data || []).map((d: any) => ({ id: d.id, supplierId: d.supplier_id, status: d.status, dateCreated: d.created_at, dateExpected: d.date_expected, notes: d.notes, supplier: d.supplier ? { id: d.supplier.id, name: d.supplier.name, contactName: d.supplier.contact_name, email: d.supplier.email, phone: d.supplier.phone } : undefined }));
    } catch (e) { return []; }
};
export const fetchPurchaseItems = async (orderId: string): Promise<PurchaseOrderItem[]> => {
    try {
        const { data, error } = await supabase.from('purchase_order_items').select('*, material:raw_materials(*)').eq('order_id', orderId);
        return (data || []).map((d: any) => ({ id: d.id, orderId: d.order_id, materialId: d.material_id, quantity: d.quantity, unitCost: d.unit_cost, material: d.material ? { id: d.material.id, code: d.material.code, name: d.material.name, unit: d.material.unit, currentStock: d.material.current_stock, minStock: d.material.min_stock, unitCost: d.material.unit_cost, category: d.material.category } : undefined }));
    } catch (e) { return []; }
};
export const savePurchaseOrder = async (order: Partial<PurchaseOrder>): Promise<string> => {
    const dbOrder = { supplier_id: order.supplierId, status: order.status, date_expected: order.dateExpected, notes: order.notes };
    if (order.id) { await supabase.from('purchase_orders').update(dbOrder).eq('id', order.id); return order.id; }
    else { const { data } = await supabase.from('purchase_orders').insert([dbOrder]).select().single(); return data.id; }
};
export const savePurchaseItem = async (item: Partial<PurchaseOrderItem>): Promise<void> => {
    await supabase.from('purchase_order_items').insert([{ order_id: item.orderId, material_id: item.materialId, quantity: item.quantity, unit_cost: item.unitCost }]);
};
export const deletePurchaseItem = async (itemId: string): Promise<void> => { await supabase.from('purchase_order_items').delete().eq('id', itemId); };
export const deletePurchaseOrder = async (orderId: string): Promise<void> => { await supabase.from('purchase_order_items').delete().eq('order_id', orderId); await supabase.from('purchase_orders').delete().eq('id', orderId); };
export const receivePurchaseOrder = async (orderId: string): Promise<void> => {
    const items = await fetchPurchaseItems(orderId);
    for (const item of items) { await processStockTransaction({ materialId: item.materialId, type: 'IN', quantity: item.quantity, notes: `Recebimento #${orderId.slice(0, 8)}` }); }
    await supabase.from('purchase_orders').update({ status: 'RECEIVED' }).eq('id', orderId);
};

export const fetchInventoryTransactions = async (): Promise<InventoryTransaction[]> => {
    try {
        const { data: trxData } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false }).limit(100);
        if (!trxData) return [];
        const materialIds = [...new Set(trxData.map((t: any) => t.material_id).filter(Boolean))];
        const { data: matData } = await supabase.from('raw_materials').select('*').in('id', materialIds);
        return trxData.map((d: any) => {
            const material = (matData || []).find((m: any) => m.id === d.material_id);
            return { id: d.id, materialId: d.material_id, type: d.type, quantity: d.quantity, notes: d.notes || '', relatedEntryId: d.related_entry_id, createdAt: d.created_at, material: material ? { id: material.id, code: material.code, name: material.name, unit: material.unit, currentStock: material.current_stock, minStock: material.min_stock, unitCost: material.unit_cost, category: material.category } : { name: 'Item Desconhecido' } as any };
        });
    } catch (e) { return []; }
};

export const fetchMaterialTransactions = async (materialId: string): Promise<InventoryTransaction[]> => {
    const { data } = await supabase.from('inventory_transactions').select('*').eq('material_id', materialId).order('created_at', { ascending: false }).limit(500);
    return (data || []).map((d: any) => ({ id: d.id, materialId: d.material_id, type: d.type, quantity: d.quantity, notes: d.notes || '', relatedEntryId: d.related_entry_id, createdAt: d.created_at }));
};

export const processStockTransaction = async (trx: Omit<InventoryTransaction, 'id' | 'createdAt' | 'material'>, newUnitCost?: number): Promise<void> => {
    const qty = Number(trx.quantity);
    const { data: mat } = await supabase.from('raw_materials').select('id, current_stock, name').eq('id', trx.materialId).single();
    if (!mat) throw new Error("Material não encontrado.");
    let newStock = Number(mat.current_stock) || 0;
    if (trx.type === 'IN') newStock += qty;
    else if (trx.type === 'OUT') newStock -= qty;
    else if (trx.type === 'ADJ') newStock = qty;
    await supabase.from('inventory_transactions').insert([{ material_id: trx.materialId, type: trx.type, quantity: trx.quantity, related_entry_id: trx.relatedEntryId, notes: trx.notes || null }]);

    const updatePayload: any = { current_stock: newStock };
    if (newUnitCost !== undefined) updatePayload.unit_cost = newUnitCost;

    await supabase.from('raw_materials').update(updatePayload).eq('id', trx.materialId);
};

export const processStockDeduction = async (entry: { productCode?: number | null, qtyOK: number, id: string }): Promise<void> => {
    if (!entry.productCode || entry.qtyOK <= 0) return;
    const bomItems = await fetchBOM(entry.productCode);
    for (const item of bomItems) {
        const consumed = item.quantityRequired * entry.qtyOK;
        await processStockTransaction({ materialId: item.materialId, type: 'OUT', quantity: consumed, notes: `Produção Auto: ${entry.qtyOK}un Prod ${entry.productCode}`, relatedEntryId: entry.id });
    }
};

export const processScrapGeneration = async (entry: ProductionEntry): Promise<void> => {
    if (!entry.productCode || !entry.machineId) return;
    const { data: product } = await supabase.from('products').select('*').eq('code', entry.productCode).single();
    const { data: machine } = await supabase.from('machines').select('sector').eq('code', entry.machineId).single();
    if (!product || !product.scrap_recycling_material_id || !machine) return;
    let factor = machine.sector === 'Extrusão' ? 0.15 : machine.sector === 'Termoformagem' ? 0.35 : 0;
    if (factor === 0) return;
    const totalQty = (entry.qtyOK || 0) + (entry.qtyDefect || 0);
    const unitWeight = entry.metaData?.measuredWeight || product.net_weight || 0;
    const weightKg = machine.sector === 'Extrusão' ? totalQty : (totalQty * unitWeight) / 1000;
    const scrapQty = weightKg * factor;
    if (scrapQty <= 0) return;
    await processStockTransaction({ materialId: product.scrap_recycling_material_id, type: 'IN', quantity: parseFloat(scrapQty.toFixed(3)), notes: `Retorno Auto (${(factor * 100).toFixed(0)}%) - Reg #${entry.id.substring(0, 8)}`, relatedEntryId: entry.id });
};

// --- LOGISTICS ---
export const fetchShippingOrders = async (): Promise<ShippingOrder[]> => {
    const { data } = await supabase.from('shipping_orders').select('*').order('created_at', { ascending: false });
    return (data || []).map((d: any) => ({ id: d.id, customerName: d.customer_name, orderNumber: d.order_number, status: d.status, scheduledDate: d.scheduled_date }));
};
export const saveShippingOrder = async (order: ShippingOrder): Promise<string> => {
    const dbOrder = { customer_name: order.customerName, order_number: order.orderNumber, status: order.status, scheduled_date: order.scheduledDate };
    if (order.id) { await supabase.from('shipping_orders').update(dbOrder).eq('id', order.id); return order.id; }
    else { const { data } = await supabase.from('shipping_orders').insert([dbOrder]).select().single(); return data.id; }
};
export const deleteShippingOrder = async (id: string): Promise<void> => { await supabase.from('shipping_orders').delete().eq('id', id); };
export const fetchShippingItems = async (orderId: string): Promise<ShippingItem[]> => {
    const { data } = await supabase.from('shipping_items').select('*, product:products(*)').eq('order_id', orderId);
    return (data || []).map((d: any) => ({ id: d.id, orderId: d.order_id, productCode: d.product_code, quantity: d.quantity, product: d.product ? { codigo: d.product.code, produto: d.product.name, descricao: d.product.description, pesoLiquido: d.product.net_weight, custoUnit: d.product.unit_cost } : undefined }));
};
export const saveShippingItem = async (item: Omit<ShippingItem, 'product'>): Promise<void> => { await supabase.from('shipping_items').insert([{ order_id: item.orderId, product_code: item.productCode, quantity: item.quantity }]); };
export const deleteShippingItem = async (id: string): Promise<void> => { await supabase.from('shipping_items').delete().eq('id', id); };

export const fetchProductCosts = async (): Promise<ProductCostSummary[]> => {
    const { data } = await supabase.from('product_costs_summary').select('*');
    return (data || []).map((d: any) => ({
        productCode: d.product_code, productName: d.product_name, sellingPrice: d.selling_price || 0,
        materialCost: d.material_cost || 0, packagingCost: d.packaging_cost || 0, operationalCost: d.operational_cost || 0,
        totalCost: d.material_cost + d.packaging_cost + d.operational_cost
    }));
};
