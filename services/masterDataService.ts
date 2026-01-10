
import { supabase } from './supabaseClient';
import { Product, Machine, Operator, DowntimeType, AppSettings, FieldDefinition, ScrapReason, WorkShift, ProductCategory, Sector } from '../types';
import { PRODUCTS_DB, MACHINES_DB, OPERATORS, DYNAMIC_FIELDS_CONFIG, SYSTEM_OPERATOR_ID } from '../constants';
import { formatError, safeNumber } from './utils';

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
    const orgId = await getCurrentOrgId();
    if (!orgId) return DEFAULT_SETTINGS;
    const { data, error } = await supabase.from('app_settings').select('*').eq('organization_id', orgId).single();
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
      thermoformingScrapLimit: data.thermoforming_scrap_limit ?? 2.0,
      includeBorraInReturn: data.include_borra_in_return ?? false,
      hardReserveStock: data.hard_reserve_stock ?? false // NEW
    };
  } catch (e) { return DEFAULT_SETTINGS; }
};


export const saveSettings = async (settings: AppSettings): Promise<{ error?: any; fallback?: boolean }> => {
  const orgId = await getCurrentOrgId();
  if (!orgId) return { error: "Organization not found" };

  // Get ID for this org's settings if exists, otherwise let it gen uuid or use org_id as key if table allows
  // Migration says app_settings has organization_id.
  // We should try to find settings for this org first.
  const { data: existing } = await supabase.from('app_settings').select('id').eq('organization_id', orgId).single();

  const fullSettings = {
    id: existing?.id, // Use existing ID to update, or undefined to insert (if table auto-generates)
    shift_hours: settings.shiftHours,
    efficiency_target: settings.efficiencyTarget,
    require_scrap_reason: settings.requireScrapReason,
    block_excess_production: settings.blockExcessProduction,
    require_downtime_notes: settings.requireDowntimeNotes,
    enable_production_orders: settings.enableProductionOrders,
    maintenance_mode: settings.maintenanceMode,
    extrusion_scrap_limit: settings.extrusionScrapLimit,
    thermoforming_scrap_limit: settings.thermoformingScrapLimit,
    include_borra_in_return: settings.includeBorraInReturn,
    hard_reserve_stock: settings.hardReserveStock,
    updated_at: new Date().toISOString(),
    organization_id: orgId
  };

  // If no existing, we insert; RLS should enforce we can only see ours.
  // The 'app_settings' table might have a constraint. 
  // Let's assume one row per org.

  // NOTE: If app_settings is singleton per org, we can upsert on organization_id if it has unique constraint?
  // Migration didn't explicitly add UNIQUE(organization_id), but let's assume get_migration_default_org handled it.
  // For safety, let's use ID if we found it effectively.

  let query;
  if (existing?.id) {
    query = supabase.from('app_settings').update(fullSettings).eq('id', existing.id);
  } else {
    // Clean undefined IDs for insertion
    delete fullSettings.id;
    query = supabase.from('app_settings').insert([fullSettings]);
  }

  const { error } = await query;

  if (error) {
    console.warn("Setting save error:", error.message, error.details, error.hint);
    alert(`ERRO DE BANCO DE DADOS DETALHADO:\n${error.message}\nDetalhes: ${error.details || 'N/A'}\nDica: ${error.hint || 'N/A'}`);

    // Legacy support for dev env
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
    if (legacyError) {
      console.error("Legacy save also failed:", legacyError);
      throw legacyError;
    }
    return { fallback: true, error };
  }
  return {};
};

// --- Outras funções omitidas para brevidade, mantendo compatibilidade ---

export const fetchFieldDefinitions = async (): Promise<FieldDefinition[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('custom_field_configs').select('*').eq('active', true).eq('organization_id', orgId);
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
  const orgId = await getCurrentOrgId();
  const dbField = {
    key: field.key,
    label: field.label,
    type: field.type,
    section: field.section,
    required: field.required,
    options: field.options,
    active: true,
    organization_id: orgId
  };
  const { error } = await supabase.from('custom_field_configs').upsert([dbField], { onConflict: 'organization_id, key' });
  if (error) throw error;
};


export const deleteFieldDefinition = async (key: string): Promise<void> => {
  const { error } = await supabase.from('custom_field_configs').update({ active: false }).eq('key', key);
  if (error) throw error;
};

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data: productsData, error: prodError } = await supabase.from('products').select('*').eq('organization_id', orgId).order('name');
    if (prodError) throw prodError;
    if (prodError) throw prodError;
    // IF RLS returns 0 rows (new org), we should show 0 rows, not fallback to Mock Data.
    if (!productsData) return [];
    // product_machines is also filtered by RLS, but we can't filter by org_id easily if it doesn't have it, relying on join
    const { data: relationsData } = await supabase.from('product_machines').select('*');
    return productsData.map((d: any) => {
      const currentProductCode = String(d.code);
      const relatedMachines = relationsData ? relationsData.filter((r: any) => String(r.product_code) === currentProductCode).map((r: any) => r.machine_code) : [];
      return {
        id: d.id,
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
        currentStock: d.current_stock || 0,
        productTypeId: d.product_type_id, // NEW
        extrusionMix: d.extrusion_mix // NEW
      };
    });
  } catch (e) { return PRODUCTS_DB; }
};


import { getCurrentOrgId } from './auth';

export const saveProduct = async (product: Product): Promise<void> => {
  // Allow alphanumeric codes
  const productCode = String(product.codigo).trim().toUpperCase();
  if (!productCode) throw new Error("Código do produto é obrigatório.");

  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error("Organização não identificada. Faça login novamente.");

  const fullProduct = {
    id: product.id, // Include ID for update
    code: productCode,
    name: product.produto,
    description: product.descricao,
    net_weight: safeNumber(product.pesoLiquido),
    unit_cost: safeNumber(product.custoUnit),
    selling_price: safeNumber(product.sellingPrice),
    items_per_hour: safeNumber(product.itemsPerHour),
    category: product.category,
    type: product.type,
    unit: product.unit,
    scrap_recycling_material_id: product.scrapMaterialId,
    current_stock: safeNumber(product.currentStock),
    product_type_id: product.productTypeId, // NEW
    extrusion_mix: product.extrusionMix, // NEW: Standard Recipe
    organization_id: orgId // Explicitly set org ID
  };

  // FIX: Use explicit Update vs Insert to allow changing the Code
  let error;

  if (product.id) {
    // Update existing
    const { error: err } = await supabase.from('products').update(fullProduct).eq('id', product.id);
    error = err;
  } else {
    // Insert new (remove undefined ID to let DB generate it)
    const { id, ...insertPayload } = fullProduct;
    const { error: err } = await supabase.from('products').insert([insertPayload]);
    error = err;
  }

  if (error) {
    console.error("Erro ao salvar produto:", error);
    throw error;
  }

  // Handle relations (cleaner way)
  if (Array.isArray(product.compatibleMachines)) {
    // Delete existing links for this product (RLS handles org isolation automatically, but safer to be specific if table has org_id)
    await supabase.from('product_machines').delete().eq('product_code', productCode); // product_machines table might need update too, assuming it's simple join table for now

    if (product.compatibleMachines.length > 0) {
      const links = product.compatibleMachines.map(mCode => ({
        product_code: productCode,
        machine_code: mCode
        // Note: product_machines usually doesn't have org_id if it's a pure join, 
        // but if RLS is on, it might need it. For now, assuming standard join.
      }));
      await supabase.from('product_machines').insert(links);
    }
  }
};

export const updateProductTarget = async (code: string, itemsPerHour: number): Promise<void> => {
  const target = isNaN(itemsPerHour) || itemsPerHour < 0 ? 0 : Number(itemsPerHour);
  // RLS ensures we only update our org's product
  await supabase.from('products').update({ items_per_hour: target }).eq('code', code);
};

export const adjustProductStock = async (code: string, newQuantity: number): Promise<void> => {
  await supabase.from('products').update({ current_stock: Number(newQuantity) }).eq('code', code);
};

export const deleteProduct = async (code: string): Promise<void> => {
  await supabase.from('products').delete().eq('code', code);
};

// ... (Categories functions remain largely same, leveraging RLS) ...

export const fetchProductCategories = async (): Promise<ProductCategory[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('product_categories').select('*').eq('organization_id', orgId).order('name');
    if (error || !data) return [];
    return data as ProductCategory[];
  } catch (e) { return []; }
};

export const saveProductCategory = async (cat: ProductCategory): Promise<void> => {
  const orgId = await getCurrentOrgId();
  await supabase.from('product_categories').upsert([{
    id: cat.id || crypto.randomUUID(),
    name: cat.name,
    organization_id: orgId
  }]);
};

export const deleteProductCategory = async (id: string): Promise<void> => {
  await supabase.from('product_categories').delete().eq('id', id);
};

export const fetchSectors = async (): Promise<Sector[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('sectors').select('*').eq('active', true).eq('organization_id', orgId).order('name');
    if (error) throw error;
    if (!data) return [];
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      active: d.active,
      isProductive: d.is_productive || false
    }));
  } catch (e) { return []; }
};

export const saveSector = async (sector: Sector): Promise<void> => {
  const orgId = await getCurrentOrgId();
  await supabase.from('sectors').upsert([{
    id: sector.id || crypto.randomUUID(),
    name: sector.name,
    active: true,
    is_productive: sector.isProductive || false,
    organization_id: orgId
  }]);
};

export const deleteSector = async (id: string): Promise<void> => {
  await supabase.from('sectors').update({ active: false }).eq('id', id);
};

export const fetchMachines = async (): Promise<Machine[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('machines').select('*').eq('organization_id', orgId);
    if (error) throw error;
    if (!data) return [];
    return data.map((d: any) => ({
      id: d.id, // NEW
      code: d.code, name: d.name, group: d.group, acquisitionDate: d.acquisition_date,
      sector: d.sector, displayOrder: d.display_order || 0, productionCapacity: d.production_capacity || 0,
      capacity_unit: d.capacity_unit || '', machine_value: d.machine_value || undefined, activity: d.activity || '', // NEW
      organizationId: d.organization_id // NEW
    })).sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  } catch (e) { return []; }
};


export const saveMachine = async (machine: Machine): Promise<void> => {
  const orgId = await getCurrentOrgId();
  if (!orgId) throw new Error("Organização não identificada.");

  const dbMachine: any = {
    code: machine.code,
    name: machine.name,
    "group": machine.group || 0,
    acquisition_date: machine.acquisitionDate,
    sector: machine.sector,
    display_order: machine.displayOrder || 0,
    production_capacity: machine.productionCapacity || 0,
    capacity_unit: machine.capacity_unit || null, // NEW
    machine_value: machine.machine_value || null, // NEW
    activity: machine.activity || null, // NEW
    organization_id: orgId
  };

  if (machine.id) {
    dbMachine.id = machine.id;
  }

  const { error } = await supabase.from('machines').upsert([dbMachine]); // Removed specific conflict target to allow ID-based update

  if (error) {
    console.error("Error saving machine:", error);
    throw error;
  }
};


export const deleteMachine = async (code: string): Promise<void> => {
  await supabase.from('machines').delete().eq('code', code);
};

export const fetchOperators = async (): Promise<Operator[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('operators').select('*').neq('id', SYSTEM_OPERATOR_ID).eq('organization_id', orgId).order('name');
    if (error) throw error;
    if (!data) return [];
    return data.map((d: any) => ({
      id: d.id, name: d.name, sector: d.sector, defaultShift: d.default_shift, role: d.role,
      baseSalary: d.base_salary, admissionDate: d.admission_date, terminationDate: d.termination_date, active: d.active ?? true
    }));
  } catch (e) { return []; }
};


export const saveOperator = async (op: Operator): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const dbOp: any = {
    name: op.name,
    sector: op.sector || null,
    default_shift: op.defaultShift || null,
    role: op.role || null,
    base_salary: op.baseSalary || null,
    admission_date: op.admissionDate || null,
    termination_date: op.terminationDate || null,
    active: op.active,
    organization_id: orgId
  };
  if (op.id) dbOp.id = op.id;

  // Operators might use a name-based composite key or just an auto-increment ID?
  // Looking at migration apply_tenant_isolation, 'operators' used 'name' as unique col.
  // So conflict target should be 'organization_id, name' if we are matching by name, or PK if ID is present.

  let conflict = 'id';
  if (!op.id) conflict = 'organization_id, name';

  const { error } = await supabase.from('operators').upsert([dbOp], { onConflict: conflict });
  if (error) throw error;
};

export const deleteOperator = async (id: number): Promise<void> => {
  await supabase.from('operators').delete().eq('id', id);
};

export const fetchDowntimeTypes = async (): Promise<DowntimeType[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('downtime_types').select('*').eq('organization_id', orgId).order('description');
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      description: d.description,
      exemptFromOperator: d.exempt_from_operator || false,
      sector: d.sector // NEW
    }));
  } catch (e) { return []; }
};

export const saveDowntimeType = async (dt: DowntimeType): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const payload = {
    id: dt.id,
    description: dt.description,
    exempt_from_operator: dt.exemptFromOperator,
    sector: dt.sector, // NEW
    organization_id: orgId
  };
  // Downtime types typically identified by UUID or ID
  const { error } = await supabase.from('downtime_types').upsert([payload]);

  if (error) {
    // Legacy support: try identifying without exempt_from_operator
    // (though if sector is the issue, this second try would also fail if sector is still present)
    const { error: retryError } = await supabase.from('downtime_types').upsert([{
      id: dt.id,
      description: dt.description,
      sector: dt.sector,
      organization_id: orgId
    }]);

    if (retryError) {
      console.error("Error saving downtime type:", error, retryError);
      throw retryError;
    }
  }
};

export const deleteDowntimeType = async (id: string): Promise<void> => {
  await supabase.from('downtime_types').delete().eq('id', id);
};

export const fetchScrapReasons = async (): Promise<ScrapReason[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('scrap_reasons').select('*').eq('active', true).eq('organization_id', orgId).order('description');
    return data.map((d: any) => ({
      id: d.id,
      description: d.description,
      sector: d.sector, // NEW
      active: d.active !== false
    })) as ScrapReason[];
  } catch (e) { return []; }
};

export const saveScrapReason = async (reason: { id?: string, description: string, sector?: string }): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const payload: any = {
    description: reason.description,
    sector: reason.sector,
    organization_id: orgId,
    active: true
  };

  if (reason.id) {
    payload.id = reason.id;
  }

  const { error } = await supabase.from('scrap_reasons').upsert([payload]);

  if (error) {
    console.error("Error saving scrap reason:", error);
    throw error;
  }
};

export const deleteScrapReason = async (id: string): Promise<void> => {
  await supabase.from('scrap_reasons').update({ active: false }).eq('id', id);
};

export const fetchWorkShifts = async (): Promise<WorkShift[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('work_shifts').select('*').eq('active', true).eq('organization_id', orgId).order('start_time');
    if (error || !data) return [];
    return data.map((d: any) => ({ id: d.id, name: d.name, startTime: d.start_time, endTime: d.end_time, active: d.active, sector: d.sector }));
  } catch (e) { return []; }
};

export const saveWorkShift = async (shift: WorkShift): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const dbShift = {
    name: shift.name,
    start_time: shift.startTime,
    end_time: shift.endTime,
    active: shift.active,
    sector: shift.sector || null,
    organization_id: orgId
  };

  if (shift.id) {
    await supabase.from('work_shifts').update(dbShift).eq('id', shift.id);
  } else {
    await supabase.from('work_shifts').insert([dbShift]);
  }
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

import { ProductTypeDefinition } from '../types';

export const fetchProductTypes = async (): Promise<ProductTypeDefinition[]> => {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase.from('product_types').select('*').eq('active', true).eq('organization_id', orgId).order('name');
    if (error || !data) return [];
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      classification: d.classification
    }));
  } catch (e) { return []; }
};

export const saveProductType = async (pt: ProductTypeDefinition): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const payload: any = {
    name: pt.name,
    classification: pt.classification,
    organization_id: orgId,
    active: true
  };

  // Only add ID if it exists (update), otherwise let DB generate it (insert)
  if (pt.id) {
    payload.id = pt.id;
  }

  const { error } = await supabase.from('product_types').upsert([payload]);
  if (error) throw error;
};

export const deleteProductType = async (id: string): Promise<void> => {
  await supabase.from('product_types').update({ active: false }).eq('id', id);
};

