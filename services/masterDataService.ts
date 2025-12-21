
import { supabase } from './supabaseClient';
import { Product, Machine, Operator, DowntimeType, AppSettings, FieldDefinition, ScrapReason, WorkShift, ProductCategory, Sector } from '../types';
import { PRODUCTS_DB, MACHINES_DB, OPERATORS, DYNAMIC_FIELDS_CONFIG, SYSTEM_OPERATOR_ID } from '../constants';
import { formatError } from './utils';

// --- System ---

export const checkConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('app_settings').select('id').limit(1).single();
    if (error && error.code !== 'PGRST116') return false;
    return true;
  } catch (e) {
    return false;
  }
};

// --- APP SETTINGS ---

const DEFAULT_SETTINGS: AppSettings = {
  shiftHours: 8.8,
  efficiencyTarget: 85,
  maintenanceMode: false,
  requireScrapReason: true,
  blockExcessProduction: false,
  requireDowntimeNotes: false,
  enableProductionOrders: true
};

export const fetchSettings = async (): Promise<AppSettings> => {
  try {
    const { data, error } = await supabase.from('app_settings').select('*').single();
    if (error || !data) return DEFAULT_SETTINGS;
    return {
      shiftHours: data.shift_hours,
      efficiencyTarget: data.efficiency_target,
      maintenanceMode: data.maintenance_mode || false,
      requireScrapReason: data.require_scrap_reason ?? true,
      blockExcessProduction: data.block_excess_production ?? false,
      requireDowntimeNotes: data.require_downtime_notes ?? false,
      enableProductionOrders: data.enable_production_orders ?? true,
      extrusionScrapLimit: data.extrusion_scrap_limit ?? 5.0,
      thermoformingScrapLimit: data.thermoforming_scrap_limit ?? 2.0
    };
  } catch (e) { return DEFAULT_SETTINGS; }
};

export const saveSettings = async (settings: AppSettings): Promise<{ error?: any; fallback?: boolean }> => {
  const fullSettings = {
    id: 1,
    shift_hours: settings.shiftHours,
    efficiency_target: settings.efficiencyTarget,
    require_scrap_reason: settings.requireScrapReason,
    block_excess_production: settings.blockExcessProduction,
    require_downtime_notes: settings.requireDowntimeNotes,
    enable_production_orders: settings.enableProductionOrders,
    maintenance_mode: settings.maintenanceMode,
    extrusion_scrap_limit: settings.extrusionScrapLimit,
    thermoforming_scrap_limit: settings.thermoformingScrapLimit,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('app_settings').upsert([fullSettings]);

  if (error) {
    // Silently try legacy save if new columns fail
    console.warn("Database schema might be outdated. Attempting legacy save.");
    const legacySettings = {
      id: 1,
      shift_hours: settings.shiftHours,
      efficiency_target: settings.efficiencyTarget,
      require_scrap_reason: settings.requireScrapReason,
      block_excess_production: settings.blockExcessProduction,
      require_downtime_notes: settings.requireDowntimeNotes,
      enable_production_orders: settings.enableProductionOrders,
      maintenance_mode: settings.maintenanceMode,
      updated_at: new Date().toISOString()
    };
    const { error: legacyError } = await supabase.from('app_settings').upsert([legacySettings]);
    if (legacyError) throw legacyError;
    return { fallback: true, error };
  }
  return {};
};

// --- Outras funções omitidas para brevidade, mantendo compatibilidade ---

export const fetchFieldDefinitions = async (): Promise<FieldDefinition[]> => {
  try {
    const { data, error } = await supabase.from('custom_field_configs').select('*').eq('active', true);
    let fields = data || DYNAMIC_FIELDS_CONFIG;
    fields = fields.filter((f: any) => f.key !== 'lote_mp');
    return fields.map((d: any) => ({
      id: d.id,
      key: d.key,
      label: d.label,
      type: d.type,
      section: d.section,
      required: d.key === 'peso_produto' ? false : d.required,
      options: d.options ? (typeof d.options === 'string' ? JSON.parse(d.options) : d.options) : undefined,
      active: d.active
    }));
  } catch (e) { return DYNAMIC_FIELDS_CONFIG; }
};

export const saveFieldDefinition = async (field: FieldDefinition): Promise<void> => {
  const dbField = { key: field.key, label: field.label, type: field.type, section: field.section, required: field.required, options: field.options, active: true };
  const { error } = await supabase.from('custom_field_configs').upsert([dbField], { onConflict: 'key' });
  if (error) throw error;
};

export const deleteFieldDefinition = async (key: string): Promise<void> => {
  const { error } = await supabase.from('custom_field_configs').update({ active: false }).eq('key', key);
  if (error) throw error;
};

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const { data: productsData, error: prodError } = await supabase.from('products').select('*').order('name');
    if (prodError) throw prodError;
    if (!productsData || productsData.length === 0) return PRODUCTS_DB;
    const { data: relationsData } = await supabase.from('product_machines').select('*');
    return productsData.map((d: any) => {
      const currentProductCode = String(d.code);
      const relatedMachines = relationsData ? relationsData.filter((r: any) => String(r.product_code) === currentProductCode).map((r: any) => r.machine_code) : [];
      return {
        codigo: d.code,
        produto: d.name,
        descricao: d.description,
        pesoLiquido: d.net_weight,
        custoUnit: d.unit_cost,
        sellingPrice: d.selling_price || 0,
        itemsPerHour: d.items_per_hour || 0,
        category: d.category || 'ARTICULADO',
        type: d.type || 'FINISHED',
        unit: d.unit || 'un',
        scrapMaterialId: d.scrap_recycling_material_id,
        compatibleMachines: relatedMachines,
        currentStock: d.current_stock || 0
      };
    });
  } catch (e) { return PRODUCTS_DB; }
};

export const saveProduct = async (product: Product): Promise<void> => {
  const safeNumber = (val: any) => (val === null || val === undefined || val === '') ? 0 : Number(val);
  const productCode = Math.floor(safeNumber(product.codigo));
  if (productCode === 0) throw new Error("Código do produto inválido.");
  const fullProduct = {
    code: productCode, name: product.produto, description: product.descricao,
    net_weight: safeNumber(product.pesoLiquido), unit_cost: safeNumber(product.custoUnit),
    selling_price: safeNumber(product.sellingPrice), items_per_hour: safeNumber(product.itemsPerHour),
    category: product.category, type: product.type, unit: product.unit,
    scrap_recycling_material_id: product.scrapMaterialId, current_stock: safeNumber(product.currentStock)
  };
  const { error } = await supabase.from('products').upsert([fullProduct], { onConflict: 'code' });
  if (error) {
    const basicProduct = { code: productCode, name: product.produto, description: product.descricao, net_weight: safeNumber(product.pesoLiquido), unit_cost: safeNumber(product.custoUnit), unit: product.unit, type: product.type, category: product.category };
    await supabase.from('products').upsert([basicProduct], { onConflict: 'code' });
  }
  if (Array.isArray(product.compatibleMachines)) {
    await supabase.from('product_machines').delete().eq('product_code', productCode);
    if (product.compatibleMachines.length > 0) {
      const links = product.compatibleMachines.map(mCode => ({ product_code: productCode, machine_code: mCode }));
      await supabase.from('product_machines').insert(links);
    }
  }
};

export const updateProductTarget = async (code: number, itemsPerHour: number): Promise<void> => {
  const target = isNaN(itemsPerHour) || itemsPerHour < 0 ? 0 : Number(itemsPerHour);
  await supabase.from('products').update({ items_per_hour: target }).eq('code', code);
};

export const adjustProductStock = async (code: number, newQuantity: number): Promise<void> => {
  await supabase.from('products').update({ current_stock: Number(newQuantity) }).eq('code', code);
};

export const deleteProduct = async (code: number): Promise<void> => {
  await supabase.from('products').delete().eq('code', code);
};

export const fetchProductCategories = async (): Promise<ProductCategory[]> => {
  try {
    const { data, error } = await supabase.from('product_categories').select('*').order('name');
    if (error || !data || data.length === 0) return [{ id: 'ARTICULADO', name: 'ARTICULADO' }, { id: 'KIT', name: 'KIT' }];
    return data as ProductCategory[];
  } catch (e) { return [{ id: 'ARTICULADO', name: 'ARTICULADO' }, { id: 'KIT', name: 'KIT' }]; }
};

export const saveProductCategory = async (cat: ProductCategory): Promise<void> => {
  await supabase.from('product_categories').upsert([{ id: cat.id || cat.name.toUpperCase(), name: cat.name }]);
};

export const deleteProductCategory = async (id: string): Promise<void> => {
  await supabase.from('product_categories').delete().eq('id', id);
};

export const fetchSectors = async (): Promise<Sector[]> => {
  try {
    const { data, error } = await supabase.from('sectors').select('*').eq('active', true).order('name');
    if (error || !data || data.length === 0) return [{ id: 'Extrusão', name: 'Extrusão', active: true, isProductive: true }, { id: 'Termoformagem', name: 'Termoformagem', active: true, isProductive: true }];
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      active: d.active,
      isProductive: d.is_productive || false // NEW: Map from DB
    }));
  } catch (e) { return [{ id: 'Extrusão', name: 'Extrusão', active: true, isProductive: true }, { id: 'Termoformagem', name: 'Termoformagem', active: true, isProductive: true }]; }
};

export const saveSector = async (sector: Sector): Promise<void> => {
  await supabase.from('sectors').upsert([{
    id: sector.id || sector.name.toUpperCase(),
    name: sector.name,
    active: true,
    is_productive: sector.isProductive || false // NEW: Save to DB
  }]);
};

export const deleteSector = async (id: string): Promise<void> => {
  await supabase.from('sectors').update({ active: false }).eq('id', id);
};

export const fetchMachines = async (): Promise<Machine[]> => {
  try {
    const { data, error } = await supabase.from('machines').select('*');
    if (error || !data || data.length === 0) return MACHINES_DB;
    return data.map((d: any) => ({
      code: d.code, name: d.name, group: d.group, acquisitionDate: d.acquisition_date,
      sector: d.sector, displayOrder: d.display_order || 0, productionCapacity: d.production_capacity || 0
    })).sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  } catch (e) { return MACHINES_DB; }
};

export const saveMachine = async (machine: Machine): Promise<void> => {
  const dbMachine: any = { code: machine.code, name: machine.name, "group": machine.group || 0, acquisition_date: machine.acquisitionDate, sector: machine.sector, display_order: machine.displayOrder || 0, production_capacity: machine.productionCapacity || 0 };
  const { error } = await supabase.from('machines').upsert([dbMachine], { onConflict: 'code' });
  if (error) {
    delete dbMachine.production_capacity;
    await supabase.from('machines').upsert([dbMachine], { onConflict: 'code' });
  }
};

export const deleteMachine = async (code: string): Promise<void> => {
  await supabase.from('machines').delete().eq('code', code);
};

export const fetchOperators = async (): Promise<Operator[]> => {
  try {
    const { data, error } = await supabase.from('operators').select('*').neq('id', SYSTEM_OPERATOR_ID).order('name');
    if (error || !data || data.length === 0) return OPERATORS;
    return data.map((d: any) => ({
      id: d.id, name: d.name, sector: d.sector, defaultShift: d.default_shift, role: d.role,
      baseSalary: d.base_salary, admissionDate: d.admission_date, terminationDate: d.termination_date, active: d.active ?? true
    }));
  } catch (e) { return OPERATORS; }
};

export const saveOperator = async (op: Operator): Promise<void> => {
  const dbOp: any = { name: op.name, sector: op.sector || null, default_shift: op.defaultShift || null, role: op.role || null, base_salary: op.baseSalary || null, admission_date: op.admissionDate || null, termination_date: op.terminationDate || null, active: op.active };
  if (op.id) dbOp.id = op.id;
  const { error } = await supabase.from('operators').upsert([dbOp]);
  if (error) throw error;
};

export const deleteOperator = async (id: number): Promise<void> => {
  await supabase.from('operators').delete().eq('id', id);
};

export const fetchDowntimeTypes = async (): Promise<DowntimeType[]> => {
  try {
    const { data, error } = await supabase.from('downtime_types').select('*').order('description');
    if (error || !data) return [];
    return data.map((d: any) => ({ id: d.id, description: d.description, exemptFromOperator: d.exempt_from_operator || false }));
  } catch (e) { return []; }
};

export const saveDowntimeType = async (dt: DowntimeType): Promise<void> => {
  const payload = { id: dt.id, description: dt.description, exempt_from_operator: dt.exemptFromOperator };
  const { error } = await supabase.from('downtime_types').upsert([payload]);
  if (error) {
    delete (payload as any).exempt_from_operator;
    await supabase.from('downtime_types').upsert([payload]);
  }
};

export const deleteDowntimeType = async (id: string): Promise<void> => {
  await supabase.from('downtime_types').delete().eq('id', id);
};

export const fetchScrapReasons = async (): Promise<ScrapReason[]> => {
  try {
    const { data, error } = await supabase.from('scrap_reasons').select('*').eq('active', true).order('description');
    return (data || []) as ScrapReason[];
  } catch (e) { return []; }
};

export const saveScrapReason = async (reason: { id?: string, description: string }): Promise<void> => {
  await supabase.from('scrap_reasons').upsert([{ id: reason.id || undefined, description: reason.description }]);
};

export const deleteScrapReason = async (id: string): Promise<void> => {
  await supabase.from('scrap_reasons').update({ active: false }).eq('id', id);
};

export const fetchWorkShifts = async (): Promise<WorkShift[]> => {
  try {
    const { data, error } = await supabase.from('work_shifts').select('*').eq('active', true).order('start_time');
    if (error || !data) return [];
    return data.map((d: any) => ({ id: d.id, name: d.name, startTime: d.start_time, endTime: d.end_time, active: d.active, sector: d.sector }));
  } catch (e) { return []; }
};

export const saveWorkShift = async (shift: WorkShift): Promise<void> => {
  const dbShift = { name: shift.name, start_time: shift.startTime, end_time: shift.endTime, active: shift.active, sector: shift.sector || null };
  if (shift.id) await supabase.from('work_shifts').update(dbShift).eq('id', shift.id);
  else await supabase.from('work_shifts').insert([dbShift]);
};

export const deleteWorkShift = async (id: string): Promise<void> => {
  await supabase.from('work_shifts').update({ active: false }).eq('id', id);
};

export const determineCurrentShift = async (timeString: string): Promise<string> => {
  const shifts = await fetchWorkShifts();
  if (shifts.length === 0) return "Turno Único";
  const [h, m] = timeString.split(':').map(Number);
  const timeMinutes = h * 60 + m;
  for (const shift of shifts) {
    const [sh1, sm1] = shift.startTime.split(':').map(Number);
    const [sh2, sm2] = shift.endTime.split(':').map(Number);
    const startMin = sh1 * 60 + sm1;
    const endMin = sh2 * 60 + sm2;
    if (endMin > startMin) { if (timeMinutes >= startMin && timeMinutes < endMin) return shift.name; }
    else { if (timeMinutes >= startMin || timeMinutes < endMin) return shift.name; }
  }
  return "Extra";
};
