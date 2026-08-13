/**
 * Maestros del control de combustible, tomados de la hoja "Listas" de
 * "Planilla de control de petroleos desde Junio 24".
 */
import type { Estanque, MovimientoCombustible } from '@/lib/types'
import movsBuin from './combustibleBuin.json'
import { uid } from '@/lib/utils'

/** Códigos de campo que usa la planilla de combustible. */
export const CAMPO_CORTO: Record<string, string> = {
  BU: 'BUIN',
  GR: 'GRANEROS',
  LL: 'LOS_LIRIOS',
  CH: 'CHUMACO',
  MG: 'GRANEROS', // Maule Graneros — se consolida en Graneros
}

export const LABORES_COMBUSTIBLE = [
  'Administración (Camionetas)',
  'Aplicación Guano',
  'Aplicación Herbicida',
  'Aplicaciones Químicas',
  'Aseo y orden general Campo',
  'Calibración',
  'Cosecha',
  'Fertilización',
  'Jardinería',
  'Labores generales',
  'Otros',
  'Plantación',
  'Servicios Externos',
  'Trabajo Suelos - Rana',
  'Trabajo Suelos - Rastra',
  'Trabajo Suelos - Subsolado simple',
  'Triturado de sarmientos',
]

export const VEHICULOS = [
  'Tractor 1',
  'Tractor 4',
  'Tractor 265',
  'Tractor 275',
  'Tractor Sonalika',
  'Fendt 311',
  'Massey Ferguson S8732',
  'Valtra',
  'New Holland',
  'Fumagri',
  'Yale',
  'Cta mazda',
  'Cta Toyota',
  'Cta volkswagen',
  'Auto Peugeot',
]

/** Especies tal como se nombran en la planilla de combustible. */
export const ESPECIES_COMBUSTIBLE = [
  'GENERAL',
  'DURAZNO CONCERVERO',
  'CEREZO',
  'UVA VINIFERA',
  'NOGAL',
  'TRIGO',
]

export const VARIEDADES_COMBUSTIBLE: Record<string, string[]> = {
  'DURAZNO CONCERVERO': ['ANDROSS', 'CARSON', 'DR. DAVIS', 'ROSS PEACH', 'KLAMPT', 'EVERTZ', 'HESSE', 'TODAS'],
  CEREZO: ['SANTINA', 'TODAS'],
  'UVA VINIFERA': ['CHARDONNAY', 'SAUVIGNON BLANC', 'SYRAH', 'CABERNET SAUVIGNON', 'TODAS'],
  NOGAL: ['CHANDLER', 'TODAS'],
  TRIGO: ['LLEUQUE', 'TODAS'],
  GENERAL: ['GENERAL'],
}

/** Centros de costo por campo usados en el control de petróleo. */
export const CC_COMBUSTIBLE: Record<string, string[]> = {
  BUIN: ['PC3;4', 'PC1;2', 'DZ23', 'DZ24', 'SANTINA24', 'TRIGAL', 'GENERAL BU'],
  LOS_LIRIOS: ['VSM', 'VSP', 'VSO', 'VBC', 'Duraznos', 'HESSE21', 'SBB', 'GENERAL LL'],
  CHUMACO: ['CH1;2', 'SA3;4', 'SY5', 'CA5', 'CAPA', 'NOGA1', 'NOGA2', 'GENERAL CH'],
  GRANEROS: [
    '401Futuro Dr. Davis', '404 Ross Peach', '405 Andross (2014)', '406 Carson',
    '402 Hesse', '403 Andross (2018)', 'Py4 NOGA18', 'Py5 NOGA19',
    'SANTINA21', 'EVERTZ22', 'GENERAL MG', 'GENERAL GR',
  ],
}

/* ─────────────── Estanques ─────────────── */

const ID_BUIN = 'estanque-buin'

export const ESTANQUES_INICIALES: Estanque[] = [
  {
    id: ID_BUIN,
    nombre: 'Estanque principal Buin',
    campo: 'BUIN',
    capacidad: 5000,
    // Calibración de la hoja "Cms-Lts": 11,5 cm equivalen a 100 litros
    cmPorCienLitros: 11.5,
    tieneContador: true,
    activo: true,
  },
  {
    id: 'estanque-graneros',
    nombre: 'Estanque Graneros',
    campo: 'GRANEROS',
    capacidad: 5000,
    cmPorCienLitros: 11.5,
    tieneContador: false,
    activo: true,
  },
  {
    id: 'estanque-loslirios',
    nombre: 'Estanque Los Lirios',
    campo: 'LOS_LIRIOS',
    capacidad: 3000,
    cmPorCienLitros: 11.5,
    tieneContador: false,
    activo: true,
  },
  {
    id: 'estanque-chumaco',
    nombre: 'Estanque Chumaco',
    campo: 'CHUMACO',
    capacidad: 3000,
    cmPorCienLitros: 11.5,
    tieneContador: false,
    activo: true,
  },
]

/* ─────────────── Movimientos reales de Buin ─────────────── */

interface FilaCruda {
  fecha: string
  accion: string
  campo: string
  especie: string
  variedad: string
  cc: string
  labor: string
  horas: number | null
  litros: number
  contador: number | null
  precio: number | null
  chofer: string
  vehiculo: string
  obs: string
  visible: number | null
}

/**
 * Historial real del estanque de Buin desde junio 2024, importado tal cual
 * desde la planilla. Son 319 movimientos con 27 controles físicos: sirve
 * para verificar que el motor reproduce los mismos números que el Excel.
 */
export function movimientosBuin(): MovimientoCombustible[] {
  return (movsBuin as FilaCruda[]).map((f) => ({
    id: uid(),
    fecha: f.fecha,
    estanqueId: ID_BUIN,
    accion: (f.accion === 'STOCK_INICIAL' ? 'STOCK_INICIAL' : f.accion) as MovimientoCombustible['accion'],
    campo: CAMPO_CORTO[f.campo] ?? f.campo,
    especie: f.especie || 'GENERAL',
    variedad: f.variedad || 'GENERAL',
    cc: f.cc || 'GENERAL BU',
    labor: f.labor || 'Otros',
    horas: f.horas ?? undefined,
    litros: f.litros ?? 0,
    contador: f.contador ?? undefined,
    precio: f.precio ?? undefined,
    chofer: f.chofer || undefined,
    vehiculo: f.vehiculo || undefined,
    observaciones: f.obs || undefined,
    visible: f.visible ?? undefined,
  }))
}
