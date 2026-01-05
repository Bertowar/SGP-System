
import { Product, Operator, Machine, FieldDefinition } from './types';

export const SYSTEM_OPERATOR_ID = 99999;

// ARQUITETURA FLEXÍVEL: Configuração Central dos Campos Extras (Fallback Local)
// Estes campos serão usados caso o banco de dados não retorne configurações
export const DYNAMIC_FIELDS_CONFIG: FieldDefinition[] = [
  {
    key: 'peso_produto',
    label: 'Peso Médio Real (g)',
    type: 'number',
    placeholder: '0.00',
    section: 'process',
    required: false
  }
];

// Data extracted from the provided image
export const PRODUCTS_DB: Product[] = [
  // --- BOBINAS (Para Extrusoras) ---
  { codigo: "1001", produto: 'BOBINA PP CRISTAL', descricao: 'Bobina de Polipropileno Cristal Extrusada', pesoLiquido: 0, custoUnit: 8.50, type: 'INTERMEDIATE', unit: 'kg' },
  { codigo: "1002", produto: 'BOBINA PP BRANCA', descricao: 'Bobina de Polipropileno Branca Extrusada', pesoLiquido: 0, custoUnit: 9.20, type: 'INTERMEDIATE', unit: 'kg' },
  { codigo: "1003", produto: 'BOBINA PP PRETA', descricao: 'Bobina de Polipropileno Preta Extrusada', pesoLiquido: 0, custoUnit: 7.80, type: 'INTERMEDIATE', unit: 'kg' },

  // --- PRODUTOS ACABADOS (Para Termoformadoras) ---
  { codigo: "9008", produto: 'P-08', descricao: 'EMBAL.RETANGULAR C/TAMPA ARTIC.PEQUENO BAIXO', pesoLiquido: 1.1783, custoUnit: 12.24, type: 'FINISHED' },
  { codigo: "90108", produto: 'PP-08', descricao: 'EMBAL.RETANGULAR C/TAMPA ARTIC.PEQ. BAIXO (PINO)', pesoLiquido: 1.2836, custoUnit: 12.90, type: 'FINISHED' },
  { codigo: "9010", produto: 'P-10', descricao: 'EMBAL.RETANGULAR C/TAMPA ARTIC.PEQUENO ALTO', pesoLiquido: 1.2312, custoUnit: 12.26, type: 'FINISHED' },
  { codigo: "90110", produto: 'PP-10', descricao: 'EMBAL.RETANGULAR C/TAMPA ARTIC.PEQ. ALTO (PINO)', pesoLiquido: 1.2472, custoUnit: 12.47, type: 'FINISHED' },
  { codigo: "9012", produto: 'P-12', descricao: 'EMB. QUAD. C/TP ART. HAMBURGUEIRA', pesoLiquido: 2.056, custoUnit: 20.35, type: 'FINISHED' },
  { codigo: "9013", produto: 'P-13', descricao: 'EMBAL.QUADRADO C/TAMPA ARTIC.', pesoLiquido: 2.7592, custoUnit: 27.22, type: 'FINISHED' },
  { codigo: "9017", produto: 'P-17', descricao: 'EMBAL.RETANGULAR C/TAMPA ARTICULADA', pesoLiquido: 2.5283, custoUnit: 25.03, type: 'FINISHED' },
  { codigo: "9018", produto: 'P-18', descricao: 'EMBAL.RETANG. C/TAMPA ARTIC GRANDE BAIXO', pesoLiquido: 3.3656, custoUnit: 32.40, type: 'FINISHED' },
  { codigo: "90118", produto: 'PP-18', descricao: 'EMBAL.RETANG. C/TAMPA ARTIC GRANDE BAIXO (PINO)', pesoLiquido: 3.3656, custoUnit: 31.23, type: 'FINISHED' },
  { codigo: "9020", produto: 'P-20', descricao: 'EMBAL.RETANG. C/TAMPA ARTIC.GRANDE ALTO', pesoLiquido: 3.3503, custoUnit: 32.28, type: 'FINISHED' },
  { codigo: "90120", produto: 'PP-20', descricao: 'EMBAL.RETANG. C/TAMPA ARTIC.GRANDE ALTO (PINO)', pesoLiquido: 2.9138, custoUnit: 27.47, type: 'FINISHED' },
  { codigo: "9088", produto: 'P-88', descricao: 'EMB. RET. C/TP ARTIC.', pesoLiquido: 1.8944, custoUnit: 20.30, type: 'FINISHED' },
  { codigo: "9090", produto: 'P-90', descricao: 'EMBAL.RETANG.BAIXO C/TAMPA ARTICULADA (500 ml)', pesoLiquido: 2.2328, custoUnit: 24.57, type: 'FINISHED' },
  { codigo: "9092", produto: 'P-92', descricao: 'EMBAL.RETANG.MEDIO C/TAMPA ARTICULADA (800 ml)', pesoLiquido: 2.5692, custoUnit: 27.33, type: 'FINISHED' },
  { codigo: "9094", produto: 'P-94', descricao: 'EMBAL.RETANG.ALTO C/TAMPA ARTICULADA (900 ml)', pesoLiquido: 2.7654, custoUnit: 28.94, type: 'FINISHED' },
  { codigo: "90550", produto: 'P-550', descricao: 'EMB. QUAD. C/TP ART. 130ML', pesoLiquido: 1.468, custoUnit: 15.71, type: 'FINISHED' },
  { codigo: "90555", produto: 'P-555', descricao: 'POTE MOLHO C/ TAMPA 50 ML', pesoLiquido: 3.2, custoUnit: 30.70, type: 'FINISHED' },
  { codigo: "90630", produto: 'P-630', descricao: 'EMB TRIANGULAR FATIA', pesoLiquido: 2.4512, custoUnit: 28.01, type: 'FINISHED' },
  { codigo: "90640", produto: 'P-640', descricao: 'EMBAL.REDONDO C/TAMPA ARTIC.PEQUENO (150 ml)', pesoLiquido: 1.5761, custoUnit: 17.94, type: 'FINISHED' },
  { codigo: "90642", produto: 'P-642', descricao: 'EMBAL.REDONDO C/TAMPA ARTIC PEQUENO (120 ml)', pesoLiquido: 1.262, custoUnit: 13.75, type: 'FINISHED' },
  { codigo: "90650", produto: 'P-650', descricao: 'EMBAL.QUADRADO C/TAMPA ARTIC.PEQUENO (150 ml)', pesoLiquido: 2.1552, custoUnit: 22.09, type: 'FINISHED' },
  { codigo: "903216", produto: 'P-32B', descricao: 'EMBAL.PET CRISTAL - KIT PRATO BR E TAMPA TR', pesoLiquido: 2.7184, custoUnit: 25.69, type: 'FINISHED' },
  { codigo: "905006", produto: 'P-50EX', descricao: 'EMBAL.PET CRISTAL - KIT PRATO BR E TAMPA TR (PIZZA)', pesoLiquido: 2.2063, custoUnit: 21.28, type: 'FINISHED' },
];

export const OPERATORS: Operator[] = [
  { id: 1, name: 'João Silva' },
  { id: 2, name: 'Maria Santos' },
  { id: 3, name: 'Carlos Oliveira' },
  { id: 4, name: 'Ana Pereira' },
  { id: 5, name: 'Roberto Souza' },
];

export const MACHINES_DB: Machine[] = [
  { code: 'EXT-01', name: 'Extrusora-01', group: 0, acquisitionDate: '2010-05-03', sector: 'Extrusão' },
  { code: 'EXT-02', name: 'Extrusora-02', group: 0, acquisitionDate: '2023-01-01', sector: 'Extrusão' },
  { code: 'TF-01', name: 'TermoFormadora-01', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
  { code: 'TF-02', name: 'TermoFormadora-02', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
  { code: 'TF-03', name: 'TermoFormadora-03', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
  { code: 'TF-04', name: 'TermoFormadora-04', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
  { code: 'TF-05', name: 'TermoFormadora-05', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
  { code: 'TF-06', name: 'TermoFormadora-06', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
  { code: 'TF-07', name: 'TermoFormadora-07', group: 0, acquisitionDate: '2010-01-01', sector: 'Termoformagem' },
];
