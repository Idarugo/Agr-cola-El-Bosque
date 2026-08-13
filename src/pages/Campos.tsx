import { useMemo, useState } from 'react'
import { Sprout, Ruler, TreeDeciduous, Droplets, MapPinned, Layers3 } from 'lucide-react'
import { BASE_OPERATIVA, TEMPORADAS } from '@/data/maestros'
import { Badge, Card, CardHeader, Kpi, PageHeader, SearchInput, Select, Vacio } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { agrupar, nfmt, suma, temporadaDe } from '@/lib/utils'

export default function Campos() {
  const { campoActivo, periodoActivo } = useStore()
  const [temporada, setTemporada] = useState(temporadaDe(`${periodoActivo}-15`))
  const [q, setQ] = useState('')

  const filas = useMemo(() => {
    const t = q.trim().toUpperCase()
    return BASE_OPERATIVA.filter((c) => c.temporada === temporada)
      .filter((c) => campoActivo === 'TODOS' || c.campo === campoActivo)
      .filter((c) => !t || `${c.cce} ${c.especie} ${c.variedad} ${c.propiedad} ${c.rol}`.toUpperCase().includes(t))
      .sort((a, b) => a.campo.localeCompare(b.campo) || a.cce.localeCompare(b.cce))
  }, [temporada, campoActivo, q])

  const has = suma(filas, (c) => c.hectareas)
  const hasProd = suma(filas, (c) => c.hectareasProd)
  const plantas = suma(filas, (c) => c.plantas)
  const especies = new Set(filas.map((c) => c.especie)).size

  const porEspecie = useMemo(
    () =>
      [...agrupar(filas, (c) => c.especie).entries()]
        .map(([especie, cs]) => ({
          especie,
          has: suma(cs, (c) => c.hectareas),
          plantas: suma(cs, (c) => c.plantas),
          cuarteles: cs.length,
          variedades: new Set(cs.map((c) => c.variedad)).size,
        }))
        .sort((a, b) => b.has - a.has),
    [filas],
  )

  const porCampo = useMemo(
    () =>
      [...agrupar(filas, (c) => c.campo).entries()]
        .map(([campo, cs]) => ({
          campo,
          has: suma(cs, (c) => c.hectareas),
          cuarteles: cs.length,
          especies: new Set(cs.map((c) => c.especie)).size,
        }))
        .sort((a, b) => b.has - a.has),
    [filas],
  )

  return (
    <>
      <PageHeader
        titulo="Campos y cuarteles"
        descripcion="Base operativa agrícola: superficie, especies, variedades y centros de costo por temporada."
        icon={Sprout}
      >
        <Select value={temporada} onChange={setTemporada} options={TEMPORADAS} className="w-44" />
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Superficie total" value={`${nfmt(has, 2)} ha`} icon={Ruler} sub={`${filas.length} cuarteles`} />
        <Kpi label="Superficie productiva" value={`${nfmt(hasProd, 2)} ha`} icon={Sprout} tone="accent"
             sub={has > 0 ? `${((hasProd / has) * 100).toFixed(0)}% del total` : '—'} />
        <Kpi label="Plantas registradas" value={nfmt(plantas, 0)} icon={TreeDeciduous} tone="sky"
             sub={`${especies} especies distintas`} />
        <Kpi label="Campos activos" value={String(porCampo.length)} icon={MapPinned} tone="violet"
             sub={`Temporada ${temporada}`} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Superficie por campo" icon={MapPinned} />
          {porCampo.length === 0 ? <Vacio titulo="Sin datos en esta temporada" /> : (
            <table className="tbl">
              <thead><tr><th>Campo</th><th className="text-right">Hectáreas</th>
                         <th className="text-right">Cuarteles</th><th className="text-right">Especies</th></tr></thead>
              <tbody>
                {porCampo.map((c) => (
                  <tr key={c.campo}>
                    <td className="font-medium text-ink">{c.campo.replace('_', ' ')}</td>
                    <td className="tnum text-right text-ink">{nfmt(c.has, 2)}</td>
                    <td className="tnum text-right text-ink-soft">{c.cuarteles}</td>
                    <td className="tnum text-right text-ink-soft">{c.especies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Superficie por especie" icon={TreeDeciduous} />
          {porEspecie.length === 0 ? <Vacio titulo="Sin datos en esta temporada" /> : (
            <table className="tbl">
              <thead><tr><th>Especie</th><th className="text-right">Hectáreas</th>
                         <th className="text-right">Variedades</th><th className="text-right">Plantas</th></tr></thead>
              <tbody>
                {porEspecie.map((e) => (
                  <tr key={e.especie}>
                    <td className="font-medium text-ink">{e.especie}</td>
                    <td className="tnum text-right text-ink">{nfmt(e.has, 2)}</td>
                    <td className="tnum text-right text-ink-soft">{e.variedades}</td>
                    <td className="tnum text-right text-ink-soft">{nfmt(e.plantas, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Detalle de cuarteles"
          subtitle={`${filas.length} registros · temporada ${temporada}`}
          icon={Layers3}
          actions={<SearchInput value={q} onChange={setQ} placeholder="CC, especie, variedad, rol…" className="w-60" />}
        />
        {filas.length === 0 ? (
          <Vacio titulo="Sin cuarteles" detalle="No hay base operativa cargada para esta combinación de campo y temporada." />
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campo</th><th>CC (N13)</th><th>Especie</th><th>Variedad</th>
                  <th>Rol</th><th>Propiedad</th>
                  <th className="text-right">Ha</th><th className="text-right">Ha prod.</th>
                  <th className="text-right">Plantas</th><th className="text-right">Hileras</th>
                  <th>Riego</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c, i) => (
                  <tr key={`${c.cce}-${c.rol}-${c.variedad}-${i}`}>
                    <td className="whitespace-nowrap text-[12px] text-ink-faint">{c.campo.replace('_', ' ')}</td>
                    <td><code className="rounded bg-brand-500/12 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{c.cce}</code></td>
                    <td className="text-ink">{c.especie}</td>
                    <td className="text-ink-soft">{c.variedad}</td>
                    <td className="tnum font-mono text-[11px] text-ink-faint">{c.rol}</td>
                    <td className="max-w-[180px] truncate text-[12px] text-ink-faint" title={c.propiedad}>{c.propiedad}</td>
                    <td className="tnum text-right text-ink">{c.hectareas ? nfmt(c.hectareas, 2) : '—'}</td>
                    <td className="tnum text-right text-ink-soft">{c.hectareasProd ? nfmt(c.hectareasProd, 2) : '—'}</td>
                    <td className="tnum text-right text-ink-soft">{c.plantas ? nfmt(c.plantas, 0) : '—'}</td>
                    <td className="tnum text-right text-ink-soft">{c.hileras || '—'}</td>
                    <td>{c.riego ? <Badge tone="sky"><Droplets className="h-3 w-3" />{c.riego}</Badge> : <span className="text-ink-faint/60">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
