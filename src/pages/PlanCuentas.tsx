import { useMemo, useState } from 'react'
import {
  Network,
  ChevronRight,
  Layers,
  Copy,
  Check,
  Wand2,
  Info,
  FolderTree,
  Hash,
} from 'lucide-react'
import {
  CUENTAS,
  CAMPOS,
  CENTROS_COSTO,
  ESPECIES,
  ETAPAS_PLANTA,
  LABORES,
  LABORES_GENERALES,
  TEMPORADAS,
  variedadesDeEspecie,
  type CuentaBase,
} from '@/data/maestros'
import { codigoCuenta } from '@/lib/motorCostos'
import type { ImputacionContable } from '@/lib/types'
import { Badge, Card, CardHeader, Field, PageHeader, SearchInput, Select, Tabs, Tip, Vacio } from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { cn } from '@/lib/utils'

/* Descripción de cada nivel, tomada del documento "Estructura del Plan de Cuentas". */
const NIVELES = [
  { n: 'N1', nombre: 'CUENTA1', desc: 'Clasificación principal', ej: 'ACTIVO, PASIVO, COSTOS, INGRESOS' },
  { n: 'N2', nombre: 'CUENTA2', desc: 'Subcategoría', ej: 'CIRCULANTE, FIJO, COSTO_OPERACIONAL' },
  { n: 'N3', nombre: 'SUBCUENTA_3', desc: 'Detalle específico', ej: 'DISPONIBLE, DIRECTOS_DE_PRODUCCION' },
  { n: 'N4', nombre: 'SUBCUENTA_4', desc: 'Partidas concretas', ej: 'CAJA, BANCOS, MANO_DE_OBRA' },
  { n: 'N5', nombre: 'SUBCUENTA_5', desc: 'Mayor detalle de la partida', ej: 'FERTILIZANTES, CONTRATISTA' },
  { n: 'N6', nombre: 'LABOR_AGRICOLA_GENERAL', desc: 'Labor amplia', ej: 'PODA, RIEGO, COSECHA' },
  { n: 'N7', nombre: 'LABOR_AGRICOLA_ESPECIFICA', desc: 'Detalle de la labor', ej: 'PODAR, CHAPODA' },
  { n: 'N8', nombre: 'ETAPA_PLANTA', desc: 'Estado en el ciclo productivo', ej: 'Planta adulta' },
  { n: 'N9', nombre: 'ESPECIE', desc: 'Clasificación agrícola', ej: 'Duraznos, Cerezos' },
  { n: 'N10', nombre: 'VARIEDAD', desc: 'Detalle de la especie', ej: 'Santina, Thompson' },
  { n: 'N11', nombre: 'CAMPO', desc: 'Predio', ej: 'Buin, Graneros' },
  { n: 'N12', nombre: 'TEMPORADA_AGRICOLA', desc: 'Período agrícola', ej: '2026-2027' },
  { n: 'N13', nombre: 'CC', desc: 'Centro de costo que consolida todo', ej: 'SANTINA21, DZ27' },
]

const TONO_N1: Record<string, string> = {
  ACTIVO: 'brand',
  PASIVO: 'red',
  PATRIMONIO: 'violet',
  COSTOS: 'accent',
  INGRESOS: 'sky',
}

export default function PlanCuentas() {
  const [tab, setTab] = useState('arbol')
  return (
    <>
      <PageHeader
        titulo="Plan de cuentas"
        descripcion="13 niveles: N1–N4 base contable, N5 clasificación extra, N6–N7 labores, N8–N12 información productiva, N13 centro de costo."
        icon={Network}
      />
      <div className="mb-5 max-w-xl">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'arbol', label: 'Árbol contable', count: CUENTAS.length },
            { id: 'constructor', label: 'Constructor de imputación' },
            { id: 'estructura', label: 'Estructura', count: 13 },
          ]}
        />
      </div>
      {tab === 'arbol' && <Arbol />}
      {tab === 'constructor' && <Constructor />}
      {tab === 'estructura' && <Estructura />}
    </>
  )
}

/* ═══════════════════ Árbol navegable ═══════════════════ */

function Arbol() {
  const [q, setQ] = useState('')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set(['COSTOS', 'COSTOS¦COSTO_OPERACIONAL']))

  const filtradas = useMemo(() => {
    const t = q.trim().toUpperCase()
    if (!t) return CUENTAS
    return CUENTAS.filter((c) =>
      [c.n1, c.n2, c.n3, c.n4, c.n5, c.codigo].join(' ').toUpperCase().includes(t),
    )
  }, [q])

  /* Estructura jerárquica N1 → N2 → N3 → N4(+N5) */
  const arbol = useMemo(() => {
    const root = new Map<string, Map<string, Map<string, CuentaBase[]>>>()
    for (const c of filtradas) {
      if (!root.has(c.n1)) root.set(c.n1, new Map())
      const l2 = root.get(c.n1)!
      if (!l2.has(c.n2)) l2.set(c.n2, new Map())
      const l3 = l2.get(c.n2)!
      if (!l3.has(c.n3)) l3.set(c.n3, [])
      l3.get(c.n3)!.push(c)
    }
    return root
  }, [filtradas])

  const toggle = (k: string) =>
    setAbiertos((s) => {
      const n = new Set(s)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  const abierto = (k: string) => q.trim().length > 0 || abiertos.has(k)

  return (
    <Card>
      <CardHeader
        title="Estructura contable N1 – N5"
        subtitle={`${filtradas.length} cuentas · los niveles N6–N13 se completan al imputar el movimiento`}
        icon={FolderTree}
        actions={<SearchInput value={q} onChange={setQ} placeholder="Buscar cuenta o código…" className="w-56" />}
      />
      {filtradas.length === 0 ? (
        <Vacio titulo="Sin resultados" detalle={`No hay cuentas que coincidan con "${q}".`} />
      ) : (
        <div className="max-h-[68vh] overflow-y-auto p-2">
          {[...arbol.entries()].map(([n1, l2]) => (
            <div key={n1} className="mb-1">
              <button
                onClick={() => toggle(n1)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-200 hover:bg-ink-faint/8"
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200',
                    abierto(n1) && 'rotate-90',
                  )}
                />
                <Badge tone={TONO_N1[n1] ?? 'slate'}>{n1}</Badge>
                <span className="ml-auto tnum text-xs text-ink-faint">
                  {[...l2.values()].reduce(
                    (a, m) => a + [...m.values()].reduce((b, x) => b + x.length, 0),
                    0,
                  )}{' '}
                  cuentas
                </span>
              </button>

              {abierto(n1) &&
                [...l2.entries()].map(([n2, l3]) => {
                  const k2 = `${n1}¦${n2}`
                  return (
                    <div key={k2} className="ml-5 border-l border-hairline pl-2">
                      <button
                        onClick={() => toggle(k2)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-200 hover:bg-ink-faint/8"
                      >
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-200',
                            abierto(k2) && 'rotate-90',
                          )}
                        />
                        <span className="text-[13px] font-medium text-ink-soft">{n2}</span>
                      </button>

                      {abierto(k2) &&
                        [...l3.entries()].map(([n3, cuentas]) => {
                          const k3 = `${k2}¦${n3}`
                          return (
                            <div key={k3} className="ml-4 border-l border-hairline pl-2">
                              <button
                                onClick={() => toggle(k3)}
                                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-200 hover:bg-ink-faint/8"
                              >
                                <ChevronRight
                                  className={cn(
                                    'h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-200',
                                    abierto(k3) && 'rotate-90',
                                  )}
                                />
                                <span className="text-[13px] text-ink-soft">{n3}</span>
                                <span className="tnum ml-auto text-[11px] text-ink-faint">
                                  {cuentas.length}
                                </span>
                              </button>

                              {abierto(k3) && (
                                <ul className="ml-4 space-y-0.5 border-l border-hairline py-1 pl-2">
                                  {cuentas.map((c, i) => (
                                    <li
                                      key={`${c.codigo}-${c.n4}-${c.n5}-${i}`}
                                      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors duration-200 hover:bg-brand-500/8"
                                    >
                                      <code className="tnum shrink-0 rounded bg-ink-faint/12 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-soft">
                                        {c.codigo}
                                      </code>
                                      <span className="text-[13px] text-ink">{c.n4}</span>
                                      {c.n5 && c.n5 !== '0' && (
                                        <>
                                          <ChevronRight className="h-3 w-3 shrink-0 text-ink-faint/60" />
                                          <span className="text-[12px] text-ink-faint">{c.n5}</span>
                                        </>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ═══════════════════ Constructor de imputación ═══════════════════ */

const VACIO: ImputacionContable = {
  n1: 'COSTOS', n2: '', n3: '', n4: '', n5: '',
  n6: '0', n7: '0', n8: '0', n9: '0', n10: '0',
  n11: '', n12: TEMPORADAS[4] ?? '2026-2027', n13: '',
}

function Constructor() {
  const [imp, setImp] = useState<ImputacionContable>(VACIO)
  const [copiado, setCopiado] = useState(false)

  const set = (k: keyof ImputacionContable, v: string) =>
    setImp((s) => {
      const n = { ...s, [k]: v }
      // Al cambiar un nivel superior se limpian los dependientes.
      if (k === 'n1') Object.assign(n, { n2: '', n3: '', n4: '', n5: '' })
      if (k === 'n2') Object.assign(n, { n3: '', n4: '', n5: '' })
      if (k === 'n3') Object.assign(n, { n4: '', n5: '' })
      if (k === 'n4') n.n5 = ''
      if (k === 'n6') n.n7 = '0'
      if (k === 'n9') n.n10 = '0'
      if (k === 'n11') n.n13 = ''
      return n
    })

  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))].sort()
  const n1s = uniq(CUENTAS.map((c) => c.n1))
  const n2s = uniq(CUENTAS.filter((c) => c.n1 === imp.n1).map((c) => c.n2))
  const n3s = uniq(CUENTAS.filter((c) => c.n1 === imp.n1 && c.n2 === imp.n2).map((c) => c.n3))
  const n4s = uniq(
    CUENTAS.filter((c) => c.n1 === imp.n1 && c.n2 === imp.n2 && c.n3 === imp.n3).map((c) => c.n4),
  )
  const n5s = uniq(
    CUENTAS.filter(
      (c) => c.n1 === imp.n1 && c.n2 === imp.n2 && c.n3 === imp.n3 && c.n4 === imp.n4,
    ).map((c) => c.n5),
  )

  const esCosto = imp.n1 === 'COSTOS'
  const completa = Boolean(imp.n1 && imp.n2 && imp.n3 && imp.n4 && imp.n11 && imp.n13)
  const codigo = completa ? codigoCuenta(imp) : '—'

  const faltantes = [
    !imp.n2 && 'N2', !imp.n3 && 'N3', !imp.n4 && 'N4',
    !imp.n11 && 'N11 (campo)', !imp.n13 && 'N13 (centro de costo)',
  ].filter(Boolean) as string[]

  const copiar = async () => {
    await navigator.clipboard.writeText(codigo)
    setCopiado(true)
    alerta.toast('Código copiado al portapapeles')
    setTimeout(() => setCopiado(false), 1800)
  }

  const dim = (k: keyof ImputacionContable) => (imp[k] && imp[k] !== '0' ? imp[k] : '000000')

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader
          title="Armar una cuenta imputable"
          subtitle="Los niveles N6–N12 se alimentan de RRHH, insumos y operaciones. Si no aplican, quedan en 000000."
          icon={Wand2}
        />
        <div className="space-y-6 p-4">
          <Bloque titulo="Base contable clásica" rango="N1 – N4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="N1 · Cuenta principal">
                <Select value={imp.n1} onChange={(v) => set('n1', v)} options={n1s} placeholder="Seleccionar…" />
              </Field>
              <Field label="N2 · Subcategoría">
                <Select value={imp.n2} onChange={(v) => set('n2', v)} options={n2s} placeholder="Seleccionar…" disabled={!imp.n1} />
              </Field>
              <Field label="N3 · Subcuenta">
                <Select value={imp.n3} onChange={(v) => set('n3', v)} options={n3s} placeholder="Seleccionar…" disabled={!imp.n2} />
              </Field>
              <Field label="N4 · Partida concreta">
                <Select value={imp.n4} onChange={(v) => set('n4', v)} options={n4s} placeholder="Seleccionar…" disabled={!imp.n3} />
              </Field>
            </div>
          </Bloque>

          <Bloque titulo="Clasificación extra" rango="N5">
            <Field label="N5 · Detalle de la partida">
              <Select value={imp.n5} onChange={(v) => set('n5', v)} options={n5s} placeholder="Sin detalle" disabled={!imp.n4} />
            </Field>
          </Bloque>

          <Bloque
            titulo="Labores agrícolas"
            rango="N6 – N7"
            nota={!esCosto ? 'Sólo aplica a cuentas de COSTOS.' : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="N6 · Labor general">
                <Select value={imp.n6} onChange={(v) => set('n6', v)} options={['0', ...LABORES_GENERALES]} disabled={!esCosto} />
              </Field>
              <Field label="N7 · Labor específica">
                <Select
                  value={imp.n7}
                  onChange={(v) => set('n7', v)}
                  options={['0', ...(LABORES[imp.n6] ?? [])]}
                  disabled={!esCosto || imp.n6 === '0'}
                />
              </Field>
            </div>
          </Bloque>

          <Bloque titulo="Información productiva" rango="N8 – N12">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="N8 · Etapa planta">
                <Select value={imp.n8} onChange={(v) => set('n8', v)} options={['0', ...ETAPAS_PLANTA.map((e) => e.nombre)]} />
              </Field>
              <Field label="N9 · Especie">
                <Select value={imp.n9} onChange={(v) => set('n9', v)} options={['0', ...ESPECIES.map((e) => e.nombre).filter(Boolean)]} />
              </Field>
              <Field label="N10 · Variedad">
                <Select
                  value={imp.n10}
                  onChange={(v) => set('n10', v)}
                  options={['0', ...variedadesDeEspecie(imp.n9).map((v) => v.variedad).filter(Boolean)]}
                  disabled={imp.n9 === '0'}
                />
              </Field>
              <Field label="N11 · Campo">
                <Select value={imp.n11} onChange={(v) => set('n11', v)} options={CAMPOS.map((c) => c.nombre)} placeholder="Seleccionar…" />
              </Field>
              <Field label="N12 · Temporada">
                <Select value={imp.n12} onChange={(v) => set('n12', v)} options={TEMPORADAS} />
              </Field>
            </div>
          </Bloque>

          <Bloque titulo="Centro de costo" rango="N13" nota="Consolida todos los niveles anteriores.">
            <Field label="N13 · Centro de costo" hint={imp.n11 ? undefined : 'Seleccione primero el campo (N11).'}>
              <Select
                value={imp.n13}
                onChange={(v) => set('n13', v)}
                options={CENTROS_COSTO.filter((c) => c.campo === imp.n11).map((c) => c.cc)}
                placeholder="Seleccionar…"
                disabled={!imp.n11}
              />
            </Field>
          </Bloque>
        </div>
      </Card>

      {/* Panel de resultado */}
      <div className="space-y-4 lg:sticky lg:top-[88px] lg:self-start">
        <Card className="overflow-hidden">
          <CardHeader title="Código generado" icon={Hash} />
          <div className="p-4">
            <div
              className={cn(
                'rounded-lg border p-3 transition-colors duration-200',
                completa
                  ? 'border-brand-500/40 bg-brand-500/8'
                  : 'border-dashed border-hairline bg-surface-soft',
              )}
            >
              <code className="tnum block break-all font-mono text-[13px] font-semibold leading-relaxed text-ink">
                {codigo}
              </code>
            </div>

            {completa ? (
              <button onClick={copiar} className="btn-primary mt-3 w-full">
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Copiado' : 'Copiar código'}
              </button>
            ) : (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-accent-500/10 p-2.5 text-xs text-accent-700 dark:text-accent-300">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>Falta completar: {faltantes.join(', ')}.</span>
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Desglose de niveles" icon={Layers} />
          <ul className="divide-y divide-hairline/60">
            {NIVELES.map((n, i) => {
              const k = `n${i + 1}` as keyof ImputacionContable
              const v = dim(k)
              const lleno = v !== '000000'
              return (
                <li key={n.n} className="flex items-center gap-2.5 px-4 py-1.5">
                  <Tip texto={`${n.nombre} — ${n.desc}`}>
                    <code
                      className={cn(
                        'tnum w-8 shrink-0 cursor-help rounded px-1 py-0.5 text-center font-mono text-[10px] font-semibold',
                        lleno ? 'bg-brand-500/18 text-brand-700 dark:text-brand-300' : 'bg-ink-faint/12 text-ink-faint',
                      )}
                    >
                      {n.n}
                    </code>
                  </Tip>
                  <span
                    className={cn(
                      'truncate text-[12px]',
                      lleno ? 'text-ink' : 'font-mono text-ink-faint/70',
                    )}
                    title={v}
                  >
                    {v}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Bloque({
  titulo,
  rango,
  nota,
  children,
}: {
  titulo: string
  rango: string
  nota?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <h4 className="text-[13px] font-semibold text-ink">{titulo}</h4>
        <code className="tnum rounded bg-brand-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-700 dark:text-brand-300">
          {rango}
        </code>
        {nota && <span className="text-[11px] text-ink-faint">{nota}</span>}
      </div>
      {children}
    </section>
  )
}

/* ═══════════════════ Estructura documentada ═══════════════════ */

function Estructura() {
  const grupos = [
    { rango: 'N1 – N4', titulo: 'Base contable clásica', desde: 0, hasta: 4, tono: 'brand' },
    { rango: 'N5', titulo: 'Clasificaciones extra', desde: 4, hasta: 5, tono: 'sky' },
    { rango: 'N6 – N7', titulo: 'Labores agrícolas', desde: 5, hasta: 7, tono: 'accent' },
    { rango: 'N8 – N12', titulo: 'Información productiva', desde: 7, hasta: 12, tono: 'violet' },
    { rango: 'N13', titulo: 'Centro de costo', desde: 12, hasta: 13, tono: 'red' },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {grupos.map((g) => (
        <Card key={g.rango} hover className={g.rango === 'N13' ? 'lg:col-span-2' : undefined}>
          <CardHeader title={g.titulo} subtitle={`Niveles ${g.rango}`} icon={Layers} />
          <ul className="divide-y divide-hairline/60">
            {NIVELES.slice(g.desde, g.hasta).map((n) => (
              <li key={n.n} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge tone={g.tono}>{n.n}</Badge>
                  <span className="font-mono text-[12px] font-medium text-ink">{n.nombre}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-soft">{n.desc}</p>
                <p className="mt-0.5 text-[11px] text-ink-faint">Ej.: {n.ej}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Card className="border-brand-500/30 bg-brand-500/5 lg:col-span-2">
        <div className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Desde el nivel <strong className="text-ink">N6</strong> la cuenta deja de llenarse a mano:
            se alimenta de los módulos de RRHH, insumos y operaciones agrícolas. Cuando una dimensión
            no aplica, se completa con <code className="rounded bg-ink-faint/12 px-1 font-mono text-[11px]">000000</code>.
            El <strong className="text-ink">N13</strong> consolida todo, pero exige que cada clasificación
            anterior esté declarada.
          </p>
        </div>
      </Card>
    </div>
  )
}
