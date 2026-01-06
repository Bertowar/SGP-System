export interface Product {
  id?: string; // NEW: UUID for internal relationship
  codigo: string;
  produto: string;
  descricao: string;
  pesoLiquido: number;
  custoUnit: number; // Custo Manual (Legado) ou Referência
  sellingPrice?: number; // Novo: Preço de Venda
  itemsPerHour?: number; // Meta de produção (Peças/Hora)
  type?: 'FINISHED' | 'INTERMEDIATE' | 'COMPONENT'; // Logística / PCP
  category?: string; // Alterado de Enum fixo para string (Dinâmico)
  scrapMaterialId?: string; // ID da MP que este produto gera ao ser refugado (Economia Circular)
  compatibleMachines?: string[]; // Array of Machine Codes
  unit?: string; // NEW: kg, un, mil, cx

  currentStock?: number; // NEW: Estoque Atual do Produto Acabado
  productTypeId?: string; // NEW: FK for dynamic type
  extrusionMix?: { type: string, subType: string, qty: string }[]; // NEW: Receita Padrão
}

export interface ProductTypeDefinition {
  id: string;
  name: string;
  classification: 'FINISHED' | 'INTERMEDIATE' | 'COMPONENT';
}

// NEW: Interface para a View Materializada de Custos
export interface ProductCostSummary {
  productCode: string;
  productName: string;
  sellingPrice: number;
  materialCost: number;
  packagingCost: number;
  operationalCost: number;
  totalCost: number; // Calculado no SQL
  // Margins are calculated in JS or SQL, prefer SQL
}

export interface Operator {
  id: number;
  name: string;
  sector?: string; // Setor vinculado
  defaultShift?: string; // NEW: Turno Padrão (ID do turno)
  role?: string; // Função
  baseSalary?: number;
  admissionDate?: string;
  terminationDate?: string;
  active?: boolean;
}

// Alterado para string para suportar cadastro dinâmico
export type MachineSector = string;

export interface Sector {
  id: string;
  name: string;
  active: boolean;
  isProductive?: boolean; // NEW: Indica se é um setor produtivo (Checkbox)
}

export interface Machine {
  id?: string; // NEW: UUID
  code: string;
  name: string;
  group?: number;
  acquisitionDate?: string;
  sector?: MachineSector;
  displayOrder?: number; // NEW: Sequence for UI layout
  productionCapacity?: number; // NEW: Capacidade Nominal
  capacity_unit?: string; // NEW: kg/h, un/h, etc
  machine_value?: number; // NEW: Valor do Patrimônio
  activity?: string; // NEW: Função desempenhada (Ex: Extrusar)
  organizationId?: string;
}

export interface MachineStatus {
  status: 'running' | 'stopped' | 'idle';
  productCode?: string;
}

export interface DowntimeType {
  id: string;
  description: string;
  exemptFromOperator?: boolean; // NEW: Flag para permitir salvar sem operador (ex: Falta de Funcionário)
  sector?: string; // NEW: Vincula o tipo de parada a um setor
}

export interface ScrapReason {
  id: string;
  description: string;
  active: boolean;
  sector?: string; // NEW
}

// NEW: Categoria de Produto Dinâmica
export interface ProductCategory {
  id: string;
  name: string;
}

// ARQUITETURA FLEXÍVEL: Definição de Campos Dinâmicos
export type FieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'boolean' | 'textarea';

export interface FieldDefinition {
  id?: string;       // ID do banco (UUID)
  key: string;       // Chave no JSON (ex: 'batch_number')
  label: string;     // Rótulo visual (ex: 'Nº do Lote')
  type: FieldType;
  required?: boolean;
  options?: string[]; // Para selects
  placeholder?: string;
  defaultValue?: any;
  section?: 'production' | 'quality' | 'process'; // Agrupamento visual
  active?: boolean;
}

export interface ProductionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  shift?: string; // Manhã, Tarde, Noite (Opcional)
  operatorId: number;
  productCode?: string | null; // Opcional para paradas
  machineId: string;
  startTime?: string; // HH:mm - Opcional para paradas apenas com duração
  endTime?: string; // HH:mm - Opcional para paradas apenas com duração
  qtyOK: number;
  qtyDefect: number;
  scrapReasonId?: string; // NEW: Motivo do Refugo
  observations: string;
  createdAt: number;

  // Novos campos específicos de Processo
  cycleRate?: number;      // Ciclagem de Máquina
  measuredWeight?: number; // Peso medido da bobina/unidade
  calculatedScrap?: number; // Apara gerada no processo (calculada)

  // New fields for Downtime
  downtimeMinutes: number;
  downtimeTypeId?: string;

  // FLEXIBILIDADE: Armazena qualquer dado extra definido na configuração
  metaData?: Record<string, any>;

  // Link to Production Order (New)
  productionOrderId?: string;
}

// --- NEW: PRODUCTION PLANNING (PCP) ---

export type ProductionOrderStatus = 'PLANNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ProductionOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ProductionOrder {
  id: string; // OP Number (e.g., OP-2024-001)
  productCode: string;
  machineId?: string; // Preferred machine
  targetQuantity: number;
  producedQuantity?: number; // Calculated field
  customerName?: string;
  deliveryDate?: string;
  status: ProductionOrderStatus;
  priority: ProductionOrderPriority;
  notes?: string;
  createdAt: string;
  product?: Product; // Join
  metaData?: Record<string, any>; // NEW: To store specific mixes/recipes

  // Phase 2 Fields
  bomId?: string;
  routeId?: string;
  salesOrderId?: string;
  version?: number;
  parentOrderId?: string; // Recursive Parent OP
}

export type ReservationStatus = 'PENDING' | 'CONSUMED' | 'RELEASED';

export interface MaterialReservation {
  id: string;
  organizationId: string;
  productionOrderId: string;
  materialId: string;
  quantity: number;
  status: ReservationStatus;
  material?: RawMaterial; // Join
}

export type WorkOrderStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface WorkOrder { // Maps to production_order_steps
  id: string;
  organizationId: string;
  productionOrderId: string;
  stepId: string; // Link to Route Step
  machineId?: string;
  operatorId?: number;

  status: WorkOrderStatus;

  qtyPlanned: number;
  qtyProduced: number;
  qtyRejected: number;

  startTime?: string;
  endTime?: string;

  step?: RouteStep; // Join
  machine?: Machine; // Join
  operator?: Operator; // Join
}

export interface DashboardMetrics {
  totalProduced: number;
  totalDefects: number;
  defectRate: number;
  entriesCount: number;
  productivity: number; // items per hour
}

// NEW: Interface agregada para o Dashboard v2 (RPC)
export interface DashboardSummary {
  kpis: {
    produced: number;
    defects: number;
    entriesCount: number;
    efficiency: number;
  };
  products: { name: string; ok: number; defect: number }[];
  operators: { name: string; ok: number; defect: number }[];
  shifts: { name: string; ok: number; defect: number }[];
  machines: any[]; // Polymorphic: Gantt events or Aggregate Stats
  isShortPeriod: boolean;
}

export type AlertType = 'quality' | 'productivity' | 'downtime';

export interface AppAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: number;
  isRead: boolean;
  relatedEntryId?: string;
}

export interface AppSettings {
  shiftHours: number;
  efficiencyTarget: number; // %
  maintenanceMode: boolean;
  // NOVAS REGRAS DE VALIDAÇÃO
  requireScrapReason: boolean;      // Exigir motivo se refugo > 0
  blockExcessProduction: boolean;   // Bloquear se qtd > capacidade teórica
  requireDowntimeNotes: boolean;    // Exigir observação em paradas
  enableProductionOrders: boolean;  // Habilitar módulo de Ordens de Produção

  // ALARM LIMITS
  extrusionScrapLimit?: number; // %
  thermoformingScrapLimit?: number; // %

  // BUSINESS RULES CONFIG
  includeBorraInReturn?: boolean; // Se true, soma Borra no Retorno (Extrusão)
}

export interface WorkShift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  active: boolean;
  sector?: string; // NEW: Vincula o turno a um setor específico (ou null para Global)
}

// --- Auth Types ---

export type UserRole = 'owner' | 'admin' | 'manager' | 'supervisor' | 'operator' | 'seller';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  organizationId?: string; // FK
  organizationName?: string; // NEW: Nome da Organização para UI
  avatarUrl?: string;
  isSuperAdmin?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  plan: 'free' | 'pro' | 'enterprise';
  ownerId: string;
  logo_url?: string;
}

// --- ERP NEW MODULES ---

// Changed to string to allow dynamic categories
export type MaterialCategory = string;

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  category: MaterialCategory;
  group?: string; // NEW: Agrupamento (Ex: Aparas, Caixas, Resinas)
  leadTime?: number; // NEW: Prazo de Entrega (Dias)
}

// NEW: BOM Header (Versioned)
export interface ProductBOMHeader {
  id: string;
  organizationId: string;
  productId: string;
  version: number;
  active: boolean;
  description?: string;
  createdAt?: string;
  items?: BOMItem[]; // Join

  // Helpers
  productCode?: string;
  productName?: string;
}

// NEW: BOM Items
export interface BOMItem {
  id: string;
  organizationId: string;
  bomId: string;
  materialId: string;
  quantity: number;
  material?: RawMaterial; // Join
}

// NEW: Interface for BOM Structure Simulation
export interface StructureItem {
  id: string; // Unique key for the tree (e.g., 'prod-123')
  type: 'PRODUCT' | 'MATERIAL' | 'OPERATION';
  name: string;
  code: string; // SKU or Operation Name
  quantity: number; // Quantity required for 1 unit of Parent
  unit: string;
  level: number; // Hierarchical level (0 = Top)

  // Costs
  unitCost: number;
  totalCost: number; // quantity * unitCost
  sellingPrice?: number; // NEW: For Root Item Margin Analysis

  // Planning
  leadTime: number; // Days (Production or Purchase)
  currentStock?: number; // Only for Materials/Products
  stockAvailable?: boolean; // True if Stock >= Net Requirement

  children?: StructureItem[];
  parentId?: string; // To help UI
}

export interface InventoryTransaction {
  id: string;
  materialId: string;
  type: 'IN' | 'OUT' | 'ADJ';
  quantity: number;
  notes?: string;
  relatedEntryId?: string;
  createdAt: string;
  createdBy?: string; // NEW: Name of user who created the transaction
  material?: RawMaterial; // For display
}

// --- PURCHASING MODULE (NEW) ---

export interface Supplier {
  id: string;
  code?: string; // NEW
  name: string;
  rating?: number; // NEW: Average rating (1-5)
  contactName?: string;
  email?: string;
  phone?: string;
}

export type PurchaseStatus = 'DRAFT' | 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: PurchaseStatus;
  dateCreated: string;
  dateExpected?: string;
  notes?: string;
  supplier?: Supplier; // Join
  items?: PurchaseOrderItem[];
  ratingPrice?: number; // NEW
  ratingDelivery?: number; // NEW
}

export interface PurchaseOrderItem {
  id: string;
  orderId: string;
  materialId: string;
  quantity: number;
  unitCost: number;
  material?: RawMaterial; // Join
}


// --- LOGISTICS MODULE ---

export interface ShippingOrder {
  id: string;
  customerName: string;
  orderNumber: string;
  status: 'PENDING' | 'SEPARATED' | 'SHIPPED';
  scheduledDate: string;
  items?: ShippingItem[];
}

export interface ShippingItem {
  id: string;
  orderId: string;
  productCode: string;
  quantity: number;

  product?: Product;
}

// --- PRODUCTION ROUTING MODULE (NEW) ---

export interface ProductRoute {
  id: string;
  organizationId: string;
  productId: string;
  version: number;
  active: boolean;
  description?: string;
  createdAt?: string;
  steps?: RouteStep[]; // Join
}

export interface RouteStep {
  id: string;
  organizationId: string;
  routeId: string;
  stepOrder: number;
  machineGroupId?: string;
  setupTime: number; // minutes
  cycleTime: number; // seconds
  minLotTransfer: number;
  description?: string;
}
// --- MRP (Material Requirements Planning) ---

export interface MRPPlanItem {
  id: string; // Unique key for the tree
  productId: string;
  productCode: string;
  name: string;
  type: 'FINISHED' | 'INTERMEDIATE' | 'COMPONENT';
  level: number;

  requiredQty: number; // Gross Requirement
  currentStock: number;
  netRequirement: number; // Max(0, Required - Stock)

  action: 'PRODUCE' | 'BUY' | 'STOCK' | 'NONE'; // NONE if netReq is 0

  leadTime: number; // Days
  unit: string;

  children?: MRPPlanItem[];

  // Metadata for creation
  bomId?: string;
  routeId?: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  previousStatus: ProductionOrderStatus;
  newStatus: ProductionOrderStatus;
  changedBy: string;
  changedAt: string;
}

export interface WorkOrderActivity {
  id: string;
  workOrderId: string;
  operationId: string;
  operatorId: number;
  producedQty: number;
  rejectedQty: number;
  materialUsed?: Record<string, any>;
  recordedAt: string;
}
