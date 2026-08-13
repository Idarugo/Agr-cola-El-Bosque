/**
 * Genera el informe de propuesta SIGA en Word, formateado para imprimir.
 * Tamaño carta, márgenes de 2,5 cm, tabla de contenidos y pie con paginación.
 */
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, VerticalAlign,
  TableOfContents, Header, Footer, PageNumber, LevelFormat, convertMillimetersToTwip,
} = require('docx')
const fs = require('fs')

/* ── Paleta y tipografía ──────────────────────────────────── */
const VERDE = '1F6B3E'
const VERDE_CLARO = 'E4F0E8'
const OCRE = '9C6410'
const OCRE_CLARO = 'F6EEDF'
const CRITICO = 'A8231B'
const CRITICO_CLARO = 'FBE9E7'
const AVISO_CLARO = 'FCF0DE'
const TINTA = '14211A'
const TINTA_SUAVE = '4A5951'
const GRIS = 'F2F5F1'
const LINEA = 'DCE4DA'

const CUERPO = 'Calibri'
const DATO = 'Consolas'

const ANCHO = 9360 // ancho útil con márgenes de 2,5 cm en carta

/* ── Ayudas de composición ────────────────────────────────── */
const p = (text, o = {}) =>
  new Paragraph({
    spacing: { after: o.after ?? 120, before: o.before ?? 0, line: o.line ?? 264 },
    alignment: o.align,
    indent: o.indent,
    border: o.border,
    shading: o.shading,
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text, font: o.font ?? CUERPO, size: o.size ?? 21, color: o.color ?? TINTA, bold: o.bold, italics: o.italics })],
  })

const t = (text, o = {}) =>
  new TextRun({ text, font: o.font ?? CUERPO, size: o.size ?? 21, color: o.color ?? TINTA, bold: o.bold, italics: o.italics })

const h1 = (num, text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 360, after: 160 },
    children: [
      new TextRun({ text: `${num}  `, font: DATO, size: 22, color: VERDE, bold: true }),
      new TextRun({ text, font: CUERPO, size: 30, color: TINTA, bold: true }),
    ],
  })

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 260, after: 110 },
    children: [new TextRun({ text, font: CUERPO, size: 23, color: TINTA, bold: true })],
  })

const h3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    spacing: { before: 200, after: 90 },
    children: [new TextRun({ text: text.toUpperCase(), font: CUERPO, size: 17, color: TINTA_SUAVE, bold: true, characterSpacing: 20 })],
  })

const lede = (text) =>
  new Paragraph({
    keepNext: true,
    spacing: { after: 200, line: 276 },
    children: [new TextRun({ text, font: CUERPO, size: 22, color: TINTA_SUAVE, italics: true })],
  })

const vinneta = (text) =>
  new Paragraph({
    numbering: { reference: 'vinetas', level: 0 },
    spacing: { after: 90, line: 264 },
    children: Array.isArray(text) ? text : [t(text)],
  })

const numerada = (text, ref) =>
  new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 90, line: 258 },
    children: Array.isArray(text) ? text : [t(text, { size: 20 })],
  })

/** Recuadro destacado con barra de color a la izquierda. */
const recuadro = (titulo, cuerpo, color = OCRE, fondo = AVISO_CLARO) => {
  const hijos = []
  if (titulo) hijos.push(p([t(titulo, { bold: true, size: 21 })], { after: 60 }))
  const parrafos = Array.isArray(cuerpo) ? cuerpo : [cuerpo]
  parrafos.forEach((c, i) =>
    hijos.push(p(Array.isArray(c) ? c : [t(c, { size: 20, color: TINTA_SUAVE })], { after: i === parrafos.length - 1 ? 0 : 80 })),
  )
  return new Table({
    columnWidths: [ANCHO],
    width: { size: ANCHO, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: fondo },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: fondo },
      right: { style: BorderStyle.SINGLE, size: 2, color: fondo },
      left: { style: BorderStyle.SINGLE, size: 24, color },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: ANCHO, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: fondo },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: hijos,
          }),
        ],
      }),
    ],
  })
}

/** Tabla de datos con encabezado. */
const tabla = (encabezados, filas, anchos, opts = {}) => {
  const celda = (contenido, i, esEncabezado, filaOpts = {}) =>
    new TableCell({
      width: { size: anchos[i], type: WidthType.DXA },
      shading: esEncabezado
        ? { type: ShadingType.CLEAR, fill: GRIS }
        : filaOpts.fondo
          ? { type: ShadingType.CLEAR, fill: filaOpts.fondo }
          : undefined,
      margins: { top: 90, bottom: 90, left: 130, right: 130 },
      verticalAlign: VerticalAlign.TOP,
      children: [
        new Paragraph({
          spacing: { after: 0, line: 240 },
          alignment: opts.derecha?.includes(i) ? AlignmentType.RIGHT : undefined,
          children: Array.isArray(contenido)
            ? contenido
            : [
                new TextRun({
                  text: String(contenido),
                  font: opts.mono?.includes(i) ? DATO : CUERPO,
                  size: esEncabezado ? 16 : (opts.size ?? 19),
                  color: esEncabezado ? TINTA_SUAVE : TINTA,
                  bold: esEncabezado,
                  characterSpacing: esEncabezado ? 20 : 0,
                }),
              ],
        }),
      ],
    })

  return new Table({
    columnWidths: anchos,
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINEA },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: LINEA },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: encabezados.map((e, i) => celda(e.toUpperCase(), i, true)),
      }),
      ...filas.map((f) => {
        const datos = Array.isArray(f) ? f : f.celdas
        const fo = Array.isArray(f) ? {} : f
        return new TableRow({ children: datos.map((c, i) => celda(c, i, false, fo)) })
      }),
    ],
  })
}

/** Bloque de verificación: concepto · valor · marca. */
const verificacion = (titulo, filas) =>
  tabla(
    [titulo, 'Resultado', ''],
    filas.map(([lbl, val, ok = true]) => [
      lbl,
      [new TextRun({ text: val, font: DATO, size: 18, color: TINTA, bold: true })],
      [new TextRun({ text: ok ? '✓' : '—', font: CUERPO, size: 20, color: ok ? VERDE : TINTA_SUAVE, bold: true })],
    ]),
    [5400, 3360, 600],
    { size: 19, derecha: [1, 2] },
  )

const espacio = (n = 200) => new Paragraph({ spacing: { after: n }, children: [] })

/* ══════════════════════════════════════════════════════════
   PORTADA
   ══════════════════════════════════════════════════════════ */
const portada = [
  espacio(1400),
  p([t('INFORME DE PROPUESTA  ·  REUNIÓN DE PRESENTACIÓN', { font: DATO, size: 17, color: VERDE, bold: true })], { after: 320 }),
  new Paragraph({
    spacing: { after: 260, line: 330 },
    children: [t('Un solo sistema para reemplazar el ecosistema de planillas', { size: 52, bold: true })],
  }),
  new Paragraph({
    spacing: { after: 500, line: 300 },
    children: [
      t('SIGA — Sistema Integrado de Gestión Agrícola. Documento preparado a partir de los siete archivos entregados por la empresa, con el detalle de qué se hace hoy en Excel, cómo queda resuelto en el sistema, qué se verificó contra los números reales y qué falta decidir.', {
        size: 23, color: TINTA_SUAVE,
      }),
    ],
  }),
  tabla(
    ['Campo', 'Detalle'],
    [
      ['Empresa', 'AGRÍCOLA EL BOSQUE LIMITADA'],
      ['RUT', '78.993.480-0'],
      ['Campos', 'Buin · Graneros · Los Lirios · Chumaco'],
      ['Estado del sistema', 'Prototipo funcional verificado'],
      ['Módulos operativos', '13'],
      ['Fecha del informe', '13 de agosto de 2026'],
    ],
    [2800, 6560],
    { mono: [1], size: 20 },
  ),
  espacio(600),
  p([t('Contenido', { size: 24, bold: true })], { after: 160 }),
  new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
]

/* ══════════════════════════════════════════════════════════
   CUERPO
   ══════════════════════════════════════════════════════════ */
const cuerpo = []
const S = (...x) => cuerpo.push(...x)

/* ── 01 ── */
S(
  h1('01', 'Resumen ejecutivo'),
  lede('Existe un prototipo funcional con trece módulos, construido sobre los maestros reales de la empresa y verificado contra los números de sus propias planillas.'),
  p('El problema central no es la falta de planillas: es que hay dos fuentes de información que nadie concilia. Por un lado la contabilidad tributaria externa, donde los cuatro campos están cargados en Nubox como empresas distintas. Por otro las planillas internas de gestión, que se construyeron sin retroalimentación hacia los administradores de campo. El resultado es duplicidad de esfuerzo, ausencia de cierres integrados y ningún dato confiable de costo real por hectárea.'),
  p([
    t('SIGA une ambos mundos en una sola base: '),
    t('la tarja alimenta el costeo, el costeo alimenta el asiento contable, y el asiento sale en el formato que el contador ya usa', { bold: true }),
    t('. Cada peso aparece simultáneamente en el mundo tributario (cuenta 5.1, Balance, Estado de Resultados) y en el mundo de gestión (labor, cuartel, especie, hectárea), sin doble digitación.'),
  ]),
  espacio(120),
  tabla(
    ['Indicador', 'Valor', 'Detalle'],
    [
      ['Módulos', '13', 'Operativos y verificados'],
      ['Archivos analizados', '7', 'Con 47 hojas de cálculo'],
      ['Maestros cargados', '100%', 'Datos reales, no de ejemplo'],
      ['Controles que cuadran', '28', 'Verificados al peso y al litro'],
    ],
    [3000, 1400, 4960],
    { mono: [1], derecha: [1], size: 20 },
  ),
  espacio(200),
  recuadro(
    'Lo que ya está resuelto',
    'Plan de cuentas de 13 niveles operativo · motor de costeo que cuadra al peso · contabilidad de doble entrada completa · control de combustible que reproduce los números de la planilla real · bodega con registro fitosanitario y control de carencias · prevención de riesgos · control de acceso con bitácora.',
    VERDE, VERDE_CLARO,
  ),
  espacio(140),
  recuadro(
    'Lo que falta y condiciona todo lo demás',
    [[
      t('El sistema guarda los datos en un solo navegador. ', { size: 20, color: TINTA_SUAVE }),
      t('No hay servidor, no hay respaldo y no pueden trabajar dos personas a la vez.', { size: 20, bold: true }),
      t(' Es la primera inversión que hay que decidir; el resto del plan depende de ella.', { size: 20, color: TINTA_SUAVE }),
    ]],
    CRITICO, CRITICO_CLARO,
  ),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 02 ── */
S(
  h1('02', 'Diagnóstico: qué pasa hoy'),
  lede('Extraído de los documentos entregados por la empresa. Las citas son textuales de su propio informe de RRHH.'),

  h2('2.1  Dos contabilidades que no se hablan'),
  new Paragraph({
    spacing: { before: 100, after: 60, line: 280 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: OCRE, space: 12 } },
    children: [t('«El contador ingresó la información a Nubox de los 4 campos como empresas distintas, sin embargo son centros de costos distintos. Nunca tuvo la intención de enlazar esta información como algo operativo.»', { size: 22, italics: true })],
  }),
  p([t('RRHH.docx · Presentación inicial', { font: DATO, size: 16, color: TINTA_SUAVE })], { indent: { left: 360 }, after: 160 }),
  p('Esa decisión, tomada por conveniencia tributaria, impide consolidar. No se puede comparar el costo de la poda en Buin contra Graneros porque están en bases separadas, y no existe un estado de resultados de la empresa como unidad.'),

  h2('2.2  La tarja no cuadra con el libro de remuneraciones'),
  new Paragraph({
    spacing: { before: 100, after: 60, line: 280 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: OCRE, space: 12 } },
    children: [t('«La tarja trabaja con valores líquidos, lo que no se complementa con el libro de remuneraciones.»', { size: 22, italics: true })],
  }),
  p([t('RRHH.docx · Problema principal', { font: DATO, size: 16, color: TINTA_SUAVE })], { indent: { left: 360 }, after: 160 }),
  p('En junio de 2026 se hizo el trabajo de cuadrarlas: se determinó el porcentaje día respecto al mes y se distribuyó el sueldo real (total haber menos asignación familiar) cruzando por RUT. Ese método funcionó, pero quedó como una macro que no se pudo replicar a los otros campos.'),

  h2('2.3  Cuatro formatos para lo mismo'),
  p('Buin y Graneros comparten estructura de tarja; Chumaco y Los Lirios tienen columnas adicionales que casi no se usan. Cada consolidación exige reconciliar formatos a mano antes de poder sumar.'),

  h2('2.4  Trabajo manual que se repite todos los meses'),
  tabla(
    ['Tarea', 'Cómo se hace hoy', 'Consecuencia'],
    [
      ['Planilla al contador', 'Se revisa la tarja, se corrigen errores, se completan datos y se arma la planilla campo por campo', 'Cuatro procesos paralelos cada mes'],
      ['Revisión de liquidaciones', 'El contador las confecciona en Nubox y las devuelve; hay que revisarlas de nuevo', 'Doble control por errores recurrentes'],
      ['Nómina bancaria', 'Se arma a mano porque Nubox no la genera; se usa un archivo con macro', 'Riesgo de error en transferencias'],
      ['Licencias médicas', 'En planilla aparte, porque el contador no permite cargarlas en Nubox', 'Tercera fuente de información'],
      ['Control de EPP', 'Manual; el jefe de campo mayoritariamente no lo usa', 'El stock nunca cuadra'],
      ['Petróleo', 'Planilla con prorrateo manual por regla de tres tras cada control', 'Diferencias que se arrastran'],
    ],
    [2200, 4400, 2760],
    { size: 19 },
  ),

  h2('2.5  Lo que está aprobado pero no se puede implementar'),
  new Paragraph({
    spacing: { before: 100, after: 60, line: 280 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: OCRE, space: 12 } },
    children: [t('«Pack motivacional — mi jefe esta parte la tiene aprobada pero no contamos con los registros para implementarla.»', { size: 22, italics: true })],
  }),
  p([t('RRHH.docx · Expectativas adicionales', { font: DATO, size: 16, color: TINTA_SUAVE })], { indent: { left: 360 }, after: 160 }),
  p('El programa de incentivos por asistencia, puntualidad y uso de EPP está autorizado desde hace tiempo. No avanza porque no existe el registro diario que lo alimente. Lo mismo ocurre con la mala evaluación recibida de la ACHS: falta el respaldo documental de charlas, capacitaciones y entrega de EPP.'),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 03 ── */
S(
  h1('03', 'Alcance de lo revisado'),
  lede('Siete archivos, cuarenta y siete hojas de cálculo, leídos completos. Todo lo que sigue está construido sobre ellos.'),
  tabla(
    ['Archivo', 'Contenido', 'Uso en el sistema'],
    [
      ['Estructura del Plan de Cuentas.docx', 'Definición conceptual de los 13 niveles', 'Implementado'],
      ['Maestro_Plan_de_Cuentas.xlsx', '17 hojas: cuentas, cargos, especies, variedades, base operativa, labores', 'Maestros cargados'],
      ['RRHH.docx', 'Diagnóstico, reglas de costeo, expectativas de seguridad e incentivos', 'Reglas implementadas'],
      ['Sistema_contable_AEB_V01.xlsx', '19 hojas: plan financiero, libro diario, mayor, balance 8 columnas, EERR', 'Módulo completo'],
      ['Planilla control de petróleos.xlsx', '11 hojas: inventario de estanque, prorrateo, calibración, stock de insumos', 'Dos módulos'],
      ['HOJA CONTEO LITROS PETROLEO.xlsx', 'Procedimiento formal de conteo en 5 pasos', 'Asistente guiado'],
      ['ae_sic2.pdf', 'Texto de Sistemas de Información Contable', 'Referencia conceptual'],
    ],
    [3100, 4260, 2000],
    { mono: [0], size: 18 },
  ),
  espacio(200),
  h3('Maestros efectivamente cargados'),
  tabla(
    ['Maestro', 'Cantidad', 'Maestro', 'Cantidad'],
    [
      ['Cuentas analíticas (13 niveles)', '141', 'Productos de bodega', '108'],
      ['Cuentas financieras', '46', 'Movimientos de petróleo reales', '319'],
      ['Cuarteles de base operativa', '124', 'Cargos con cuenta contable', '14'],
      ['Centros de costo', '40', 'Variedades en 7 especies', '22'],
    ],
    [3080, 1600, 3080, 1600],
    { mono: [1, 3], derecha: [1, 3], size: 19 },
  ),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 04 ── */
S(
  h1('04', 'Excel → Sistema, tarea por tarea'),
  lede('La equivalencia directa entre lo que se hace hoy y cómo queda resuelto. Ésta es la tabla central del informe.'),
  tabla(
    ['Tarea', 'Hoy, en Excel', 'En el sistema', 'Cambio'],
    [
      ['Registro de asistencia', 'Cuatro tarjas con formatos distintos, una por campo', 'Una grilla mensual única: trabajador × día, con labor, centro de costo, hora de llegada y tipo de día', 'Formato único · carga masiva'],
      ['Días no trabajados', 'El trato se marcaba como “no trabajador” para efectos de liquidación', 'Nueve tipos de día tipificados; el trato se convierte a equivalencia de jornada real', 'Trazabilidad de asistencia'],
      ['Distribución del costo', 'Macro y Power Query sobre la tarja, replicable sólo en Buin', 'Motor que reparte con las reglas escritas en el documento de RRHH, para cualquier campo y período', 'Cuadra al peso'],
      ['Libro de remuneraciones', 'Se cruza a mano con BUSCARX por RUT', 'Se importa el export de Nubox; el cruce por RUT es automático con vista previa', 'Sin digitación'],
      ['Planilla para el contador', 'Se arma campo por campo cada mes', 'Un botón: 24 columnas por trabajador más la asistencia día a día', 'De horas a segundos'],
      ['Nómina bancaria', 'Archivo aparte con macro, porque Nubox no la genera', 'Se genera con RUT, banco, cuenta y líquido; hoja separada de anticipos', 'Control de cuentas faltantes'],
      ['Asiento contable', 'Se arma en el libro diario del archivo contable', 'Se genera desde el cierre de costos con vista previa; cuadra por construcción', 'Une gestión y tributario'],
      ['Estados financieros', 'Fórmulas encadenadas; borrar una fila rompe el archivo', 'Mayor, Balance 8 columnas, EERR y Balance General se recalculan desde el diario', 'No hay fórmulas que romper'],
      ['Control de petróleo', 'Planilla de inventario con prorrateo manual', 'Movimientos, control físico, prorrateo automático y hoja de conteo de 5 pasos', 'Detecta entregas sin registrar'],
      ['Medición del estanque', 'Regla de tres en una hoja auxiliar', 'Calibración por estanque: se ingresan centímetros y entrega litros', 'Editable por estanque'],
      ['Stock de agroquímicos', 'Hojas de stock por campo, conteo contra registros', 'Inventario con conteo físico y ajuste automático', 'El ajuste deja la diferencia en cero'],
      ['Registro de aplicaciones', 'Formulario M2-008-F004 en papel, separado del stock', 'Formulario completo que descuenta el producto de bodega al registrarse', 'Por eso el stock nunca cuadraba'],
      ['Carencias', 'Se sabe de memoria o se revisa la etiqueta', 'Cada aplicación bloquea el cuartel y muestra desde qué fecha se puede cosechar', 'Protege la certificación'],
      ['Entrega de EPP', 'Registro manual que el jefe de campo no usa', 'Matriz por cargo, entrega firmada que descuenta stock, ficha por trabajador', 'Respaldo para la ACHS'],
      ['Charlas de seguridad', 'No queda registro sistemático', 'Charla diaria con riesgos, medidas y asistentes', 'Responde a la evaluación ACHS'],
      ['Pack motivacional', 'Aprobado, sin registros que lo alimenten', 'Semillas por asistencia, puntualidad, EPP y rendimiento; catálogo y canjes', 'La tarja genera los registros'],
      ['Quién hizo qué', 'El archivo lo abre cualquiera', 'Cinco roles con permisos por módulo y bitácora exportable', 'Base del control documental'],
    ],
    [1850, 2700, 2960, 1850],
    { size: 17 },
  ),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 05 ── */
S(
  h1('05', 'Los trece módulos'),
  lede('Agrupados según cómo se usan: gestión, operación diaria, cumplimiento y maestros.'),
  tabla(
    ['Grupo', 'Módulo', 'Qué hace'],
    [
      { celdas: ['Gestión', 'Dashboard', 'Costo por jornada, por hectárea, por labor y por especie. Alertas automáticas de lo que requiere atención antes de cerrar el mes.'] },
      ['Gestión', 'Costos y cierre', 'Motor de distribución, libro de remuneraciones y generación del asiento con las 13 dimensiones.'],
      ['Gestión', 'Contabilidad', 'Libro Diario, control de asientos, Libro Mayor, Balance de 8 columnas, Estado de Resultados y Balance General.'],
      ['Gestión', 'Reportes', 'Seis exportaciones a Excel en el formato que ya usan el contador, el banco y las certificadoras.'],
      ['Operación', 'Tarja digital', 'Grilla mensual con nueve tipos de día y carga masiva por cuadrilla.'],
      ['Operación', 'Personal', 'Ficha de trabajador con RUT validado, cargo enlazado a su cuenta contable, datos bancarios y tallas para EPP.'],
      ['Operación', 'Combustible', 'Movimientos de estanque, hoja de conteo de 5 pasos, prorrateo y consumo por CC, labor, vehículo y chofer.'],
      ['Operación', 'Bodega e insumos', 'Stock de 108 productos, conteo físico con ajuste, registro M2-008-F004 y control de carencias.'],
      ['Operación', 'Campos y cuarteles', 'Base operativa: superficie, especies, variedades, riego y plantas por centro de costo y temporada.'],
      ['Cumplimiento', 'Prevención y EPP', 'Matriz de EPP por cargo, entregas firmadas, capacitaciones con vencimiento y charlas diarias.'],
      ['Cumplimiento', 'Pack motivacional', 'Ranking de semillas con puntualidad calculada desde las horas de llegada, catálogo y canjes.'],
      ['Maestros', 'Plan de cuentas', 'Árbol navegable N1–N5 y constructor que arma el código completo de 13 niveles.'],
      ['Maestros', 'Usuarios y acceso', 'Cinco roles con permisos por módulo, campos asignados y bitácora de quién hizo qué.'],
    ],
    [1500, 2100, 5760],
    { size: 18 },
  ),

  h2('5.1  El plan de cuentas de 13 niveles'),
  p('Implementado tal como está documentado. Desde el nivel N6 la cuenta deja de llenarse a mano: la alimentan RRHH, insumos y operaciones. Cuando una dimensión no aplica, queda en ceros.'),
  tabla(
    ['Niveles', 'Contenido', 'Ejemplo'],
    [
      ['N1 – N4', 'Base contable clásica', 'ACTIVO › CIRCULANTE › DISPONIBLE › CAJA'],
      ['N5', 'Clasificación extra', 'FERTILIZANTES · CONTRATISTA'],
      ['N6 – N7', 'Labores agrícolas', 'PODA › PINTAR CORTES'],
      ['N8 – N12', 'Información productiva', 'Etapa · Especie · Variedad · Campo · Temporada'],
      ['N13', 'Centro de costo', 'DZ23 · SANTINA24'],
      { celdas: ['Resultado', 'Código generado', '4112 / 9-3-2-2-1 / 1-5-5'], fondo: VERDE_CLARO },
    ],
    [1500, 3200, 4660],
    { mono: [2], size: 19 },
  ),

  h2('5.2  Las reglas de costeo, tal como están escritas'),
  vinneta([t('Trabajador agrícola: ', { bold: true }), t('sueldo base ÷ 30 × días del mes.')]),
  vinneta([t('Administrativo: ', { bold: true }), t('sueldo base ÷ 30 × días trabajados, imputado a SUELDOS_ADM pero integrado al costo empresa.')]),
  vinneta([t('Con libro cargado: ', { bold: true }), t('la base real pasa a ser total haber menos asignación familiar — el número que cuadra con contabilidad.')]),
  vinneta([t('Vacaciones: ', { bold: true }), t('jornada válida, se redistribuye sobre lo efectivamente trabajado.')]),
  vinneta([t('Sin labor: ', { bold: true }), t('no cuenta como jornada real, no diluye el costo.')]),
  vinneta([t('Fin de semana trabajado: ', { bold: true }), t('jornada efectiva, sin excepción.')]),
  vinneta([t('Trato: ', { bold: true }), t('convertido a equivalencia de jornada real, porque el trabajador sí asistió.')]),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 06 ── */
S(
  h1('06', 'Verificación contra los números reales'),
  lede('No basta con que compile. Cada motor se probó contra las cifras de las planillas de la empresa, fuera de la aplicación.'),

  h3('6.1  Motor de costeo · Buin, julio 2026'),
  verificacion('Distribución de mano de obra', [
    ['Total distribuido', '$18.051.250'],
    ['Base esperada (total haber − asignación familiar)', '$18.051.250'],
    ['Desvío', '0 — cuadra al peso'],
    ['Líneas SIN_LABOR incluidas en el reparto', '0'],
    ['Líneas con las 13 dimensiones completas', 'todas'],
  ]),
  espacio(200),

  h3('6.2  Contabilidad · ejercicio 2026, 9 asientos'),
  verificacion('Partida doble y estados financieros', [
    ['Asientos descuadrados', '0'],
    ['Σ Debe = Σ Haber', '$1.027.301.500'],
    ['Activo + Pérdidas = Pasivo + Ganancias', '$942.435.500'],
    ['Descuadre del Balance General', '0'],
    ['EERR coincide con el Balance de 8 columnas', 'sí'],
    ['Costo del motor = saldo de la cuenta 5.1', '$53.135.500'],
    ['Líneas de costo con N6 / N11 / N13', '931 de 931'],
  ]),
  espacio(140),
  p([
    t('La última línea es la que importa: '),
    t('el mismo peso aparece en los dos mundos', { bold: true }),
    t(', con las 13 dimensiones intactas dentro del asiento contable.'),
  ]),

  h3('6.3  Combustible · estanque de Buin, 319 movimientos reales'),
  verificacion('Contra los valores de la planilla', [
    ['Stock estimado', '−1.840 L   (planilla: −1840)'],
    ['Visible en el último control', '200 L   (planilla: 200)'],
    ['Diferencia', '+2.040 L   (planilla: 2040)'],
    ['Total entradas', '11.672 L'],
    ['Total salidas', '13.512 L'],
    ['Controles registrados', '27'],
    ['Calibración: 8,1 cm', '70,43 L   (planilla: 70,43)'],
  ]),
  espacio(160),
  verificacion('Prorrateo del control del 19-06-2024 · diferencia de −19 L', [
    ['SANTINA24 · 46 L consumidos', '−9,6 L   (planilla: −9,6)'],
    ['GENERAL BU · 45 L consumidos', '−9,4 L   (planilla: −9,4)'],
  ]),

  h3('6.4  Hoja de conteo · los 5 pasos'),
  verificacion('Reproducción del ejemplo de la planilla', [
    ['Paso 1 · saldo inicial 292 + compras 701', '993 L'],
    ['Paso 2 · suma de 7 entregas', '260 L'],
    ['Paso 3 · contador 267.363 − 267.103', '260 L — cuadra'],
    ['Paso 4 · saldo contable / visible', '733 L / 890 L'],
    ['Paso 5 · diferencia e interpretación', '−157 L → CALIBRAR'],
  ]),
  espacio(140),
  p('El paso 3 es un control que la planilla de inventario no tenía: cruza el registro manual contra el contador mecánico. Se probó quitando una entrega de 68 L y el sistema avisó que faltaban registrar exactamente esos 68 litros.'),

  h3('6.5  Bodega y aplicaciones'),
  verificacion('Controles del módulo', [
    ['Productos con stock negativo', '0'],
    ['Aplicaciones con su salida de bodega', 'todas'],
    ['Dosis/ha 2,5 × 8 ha', '20 unidades'],
    ['Dosis/100L 0,8 · 1200 L/ha · 5 ha', '48 unidades'],
    ['Carencia 14 días desde 01-08-2026', 'cosechable 15-08-2026'],
    ['Ajuste por conteo deja la diferencia en', 'cero'],
  ]),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 07 ── */
S(
  h1('07', 'Hallazgos sobre los datos reales'),
  lede('Al cargar la información verdadera aparecieron cosas que la planilla no muestra. Son diagnósticos, no fallas del sistema.'),
  recuadro(
    'El estanque de Buin acumula un déficit de 1.840 litros',
    'Según los registros debería haber −1.840 L, es decir el sistema de registro dice que se entregó más combustible del que entró. Físicamente hay 200 L. La diferencia acumulada es de 2.040 litros, que a precio promedio equivalen a aproximadamente $1,5 millones sin imputar a ningún centro de costo.',
    CRITICO, CRITICO_CLARO,
  ),
  espacio(140),
  recuadro(
    '24 de 25 períodos requieren calibración',
    'Al correr la hoja de conteo sobre todo el historial, en 24 meses el resultado es «hay más petróleo del que indica la máquina». Es un patrón, no ruido: apunta a que el estanque está sistemáticamente descalibrado. Corregir la calibración es más rentable que seguir prorrateando diferencias.',
  ),
  espacio(140),
  recuadro(
    'Cuatro períodos con descuadre entre el contador y los registros',
    'En cuatro meses la suma de entregas anotadas no coincide con lo que marcó el contador mecánico del estanque. Significa que hubo entregas sin registrar, y ningún prorrateo posterior corrige eso.',
  ),
  espacio(140),
  recuadro(
    '65 de 108 productos no tienen ingrediente activo declarado',
    'Sin ese dato, el registro de aplicaciones queda incompleto ante una certificadora. El sistema los marca en pantalla en vez de dejarlos pasar en silencio.',
  ),

  h2('7.1  Errores detectados y corregidos durante la construcción'),
  p('Se documentan porque muestran el tipo de revisión aplicada, y porque algunos afectaban números que parecían correctos.'),
  tabla(
    ['Hallazgo', 'Efecto', 'Estado'],
    [
      ['Los códigos N6 y N7 se generaban por orden alfabético', 'El código de cuenta no coincidía con el del maestro. ADMINISTRACIÓN daba 1 en vez de 14', 'Corregido'],
      ['La lista de labores de DESBROTE quedó con 56 ítems en vez de 7', 'Un error de lectura del bloque de Excel arrastró labores de otras categorías', 'Corregido'],
      ['El Balance General descuadraba por $1.672.000', 'Los anticipos de sueldo, una cuenta de activo con saldo acreedor, no se restaban del activo', 'Corregido'],
      ['El prorrateo cortaba por fecha y no por orden de registro', 'Un control y sus ajustes llevan la misma fecha; el estimado incluía movimientos posteriores', 'Corregido'],
      ['El prorrateo contaba las calibraciones como consumo', 'Una calibración sale y vuelve; no es combustible usado. Por eso la hoja habla de salidas netas', 'Corregido'],
    ],
    [3300, 4460, 1600],
    { size: 18 },
  ),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 08 ── */
S(
  h1('08', 'En qué ayuda concretamente'),
  lede('Ordenado por quién recibe el beneficio.'),

  h2('8.1  Para control interno y contabilidad'),
  vinneta([t('Un solo cierre para los cuatro campos', { bold: true }), t(' en vez de cuatro procesos paralelos que después hay que consolidar a mano.')]),
  vinneta([t('El asiento se genera solo', { bold: true }), t(' desde el cierre de costos y cuadra por construcción: el líquido se calcula por diferencia.')]),
  vinneta([t('Advertencias antes de enviar al contador: ', { bold: true }), t('trabajadores activos sin tarja, jornadas sin labor, liquidaciones faltantes.')]),
  vinneta([t('La revisión de liquidaciones se apoya en datos: ', { bold: true }), t('la planilla de asistencia con días, faltas, atrasos y horas extra sale del mismo registro que alimenta el costo.')]),
  vinneta([t('Nómina bancaria con control', { bold: true }), t(' de trabajadores sin datos de cuenta.')]),
  vinneta([t('No hay fórmulas que romper: ', { bold: true }), t('borrar una fila no puede dañar los estados financieros.')]),

  h2('8.2  Para gerencia'),
  vinneta([t('Costo real por jornada', { bold: true }), t(' — el dato que ya causó impacto cuando se presentó la tarja de Buin ajustada.')]),
  vinneta([t('Costo por hectárea y por centro de costo', { bold: true }), t(', comparable entre campos y entre especies.')]),
  vinneta([t('El mismo peso mirado desde ocho ángulos: ', { bold: true }), t('labor, labor específica, especie, variedad, campo, cuenta, etapa de planta y centro de costo.')]),
  vinneta([t('Estado de Resultados de la empresa como unidad', { bold: true }), t(', no cuatro empresas separadas.')]),

  h2('8.3  Para los administradores de campo'),
  vinneta([t('Un formato único de tarja', { bold: true }), t(', con carga masiva por cuadrilla.')]),
  vinneta([t('Cada uno ve sólo su campo', { bold: true }), t(', sin riesgo de tocar lo ajeno.')]),
  vinneta([t('El petróleo deja de ser una discusión: ', { bold: true }), t('el sistema muestra el consumo por vehículo, chofer y labor.')]),
  vinneta([t('Bodega con stock que cuadra', { bold: true }), t(', porque la aplicación descuenta el producto sola.')]),

  h2('8.4  Para cumplimiento y certificación'),
  vinneta([t('Registro de aplicaciones M2-008-F004', { bold: true }), t(' completo, con ingrediente activo, dosis, mojamiento y carencia.')]),
  vinneta([t('Bloqueo de cuarteles en carencia: ', { bold: true }), t('el sistema dice desde qué fecha se puede cosechar.')]),
  vinneta([t('Respaldo para la ACHS: ', { bold: true }), t('charlas diarias con riesgos y asistentes, capacitaciones con vencimiento, EPP entregado y firmado.')]),
  vinneta([t('Bitácora de quién hizo qué', { bold: true }), t(', que es la base del control documental que exige ISO 9000.')]),

  h2('8.5  Para los trabajadores'),
  vinneta([t('El pack motivacional deja de ser una idea: ', { bold: true }), t('la tarja genera los registros de asistencia, puntualidad y uso de EPP que lo alimentan.')]),
  vinneta([t('Ficha personal', { bold: true }), t(' con capacitaciones realizadas e historial de EPP.')]),
  vinneta([t('El trato queda reflejado como asistencia real', { bold: true }), t(', lo que mejora el control de licencias y seguridad.')]),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 09 FODA ── */
const fodaCelda = (titulo, etiqueta, items, fondo, ref) =>
  new TableCell({
    width: { size: 4680, type: WidthType.DXA },
    margins: { top: 120, bottom: 140, left: 160, right: 160 },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        spacing: { after: 40 },
        shading: { type: ShadingType.CLEAR, fill: fondo },
        children: [t(titulo, { bold: true, size: 22 })],
      }),
      new Paragraph({
        spacing: { after: 140 },
        children: [t(etiqueta, { font: DATO, size: 15, color: TINTA_SUAVE })],
      }),
      ...items.map((it) => numerada(it, ref)),
    ],
  })

S(
  h1('09', 'Análisis FODA'),
  lede('Del proyecto de implementación, no del sistema como pieza de software.'),
  new Table({
    columnWidths: [4680, 4680],
    width: { size: 9360, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
    },
    rows: [
      new TableRow({
        children: [
          fodaCelda('Fortalezas', 'INTERNO · FAVORABLE', [
            [t('El plan de cuentas de 13 niveles ya está diseñado', { bold: true, size: 20 }), t(' y documentado. No hubo que inventarlo: es un activo intelectual que muchas agrícolas no tienen.', { size: 20 })],
            [t('Los maestros están completos y estructurados', { bold: true, size: 20 }), t(' — cuentas, cuarteles, especies, variedades, cargos, labores.', { size: 20 })],
            [t('Existe una contraparte con visión de control interno', { bold: true, size: 20 }), t(' que ya cuadró junio 2026 manualmente. El método estaba probado antes de automatizarlo.', { size: 20 })],
            [t('Hay historia real cargable:', { bold: true, size: 20 }), t(' 319 movimientos de combustible desde junio 2024 y conteos físicos de bodega.', { size: 20 })],
            [t('El prototipo está construido y verificado', { bold: true, size: 20 }), t(', no es una presentación de intenciones.', { size: 20 })],
          ], VERDE_CLARO, 'fo'),
          fodaCelda('Debilidades', 'INTERNO · ADVERSO', [
            [t('Sin servidor no hay sistema multiusuario.', { bold: true, size: 20 }), t(' Hoy los datos viven en un navegador: no hay respaldo ni trabajo simultáneo.', { size: 20 })],
            [t('Dependencia de una sola persona.', { bold: true, size: 20 }), t(' El conocimiento del método de costeo está concentrado.', { size: 20 })],
            [t('Datos maestros incompletos:', { bold: true, size: 20 }), t(' 65 productos sin ingrediente activo, carencias por cargar, calibración medida sólo en Buin.', { size: 20 })],
            [t('El mapeo de cuentas está parcialmente supuesto.', { bold: true, size: 20 }), t(' Sólo seis cruces provienen del asiento real.', { size: 20 })],
            [t('Cultura de registro débil en terreno:', { bold: true, size: 20 }), t(' el control de EPP existía y no se usaba.', { size: 20 })],
          ], CRITICO_CLARO, 'de'),
        ],
      }),
      new TableRow({
        children: [
          fodaCelda('Oportunidades', 'EXTERNO · FAVORABLE', [
            [t('Certificación ISO 9000 y de campos.', { bold: true, size: 20 }), t(' El control documental es justamente lo que falta y el sistema lo produce como subproducto.', { size: 20 })],
            [t('Costo por hectárea confiable', { bold: true, size: 20 }), t(' habilita decisiones que hoy no se pueden tomar: qué variedad conviene, qué cuartel arrancar, qué labor tercerizar.', { size: 20 })],
            [t('Informes a clientes, certificadoras, SAG y ACHS', { bold: true, size: 20 }), t(' salen del mismo registro.', { size: 20 })],
            [t('Posición negociadora:', { bold: true, size: 20 }), t(' una agrícola que muestra trazabilidad completa accede a clientes que hoy la exigen.', { size: 20 })],
            [t('Corregir la calibración del estanque', { bold: true, size: 20 }), t(' tiene retorno inmediato y medible.', { size: 20 })],
          ], OCRE_CLARO, 'op'),
          fodaCelda('Amenazas', 'EXTERNO · ADVERSO', [
            [t('Resistencia del contador externo.', { bold: true, size: 20 }), t(' El sistema le cambia el flujo de trabajo; si no coopera, se duplica el esfuerzo.', { size: 20 })],
            [t('Adopción en terreno.', { bold: true, size: 20 }), t(' Si los jefes de campo no registran la tarja diaria, el sistema queda vacío.', { size: 20 })],
            [t('Conectividad en los campos.', { bold: true, size: 20 }), t(' Hay que verificar señal antes de comprometer un modelo en línea.', { size: 20 })],
            [t('Pérdida de datos mientras no haya respaldo.', { bold: true, size: 20 }), t(' Un navegador borrado hoy significa empezar de cero.', { size: 20 })],
            [t('Estacionalidad:', { bold: true, size: 20 }), t(' implantar durante cosecha compite con el momento de mayor carga operativa.', { size: 20 })],
          ], AVISO_CLARO, 'am'),
        ],
      }),
    ],
  }),
  espacio(200),
  recuadro('Lectura cruzada', [[
    t('La combinación más peligrosa es ', { size: 20, color: TINTA_SUAVE }),
    t('debilidad 1 con amenaza 4', { size: 20, bold: true }),
    t(': sin servidor y sin respaldo, cualquier avance es frágil. La más aprovechable es ', { size: 20, color: TINTA_SUAVE }),
    t('fortaleza 1 con oportunidad 1', { size: 20, bold: true }),
    t(': el plan de cuentas ya diseñado es exactamente la estructura que una certificación exige documentar.', { size: 20, color: TINTA_SUAVE }),
  ]]),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 10 Carta Gantt ── */
const QUINCENAS = 12
const ANCHO_FASE = 2760
const ANCHO_Q = Math.floor((9360 - ANCHO_FASE) / QUINCENAS) // 550
const fases = [
  { n: '1 · Validación de maestros', d: 'Cuentas, carencias, calibración, mapeo', desde: 1, hasta: 2, color: VERDE, sem: 'S1–S3' },
  { n: '2 · Servidor y respaldo', d: 'Backend, multiusuario, respaldo automático', desde: 1, hasta: 4, color: CRITICO, sem: 'S2–S8 · ruta crítica' },
  { n: '3 · Piloto en Buin', d: 'Tarja y combustible en operación real', desde: 3, hasta: 6, color: VERDE, sem: 'S6–S12' },
  { n: '4 · Cierre paralelo', d: 'Un mes en Excel y en sistema a la vez', desde: 5, hasta: 8, color: OCRE, sem: 'S10–S16' },
  { n: '5 · Despliegue 4 campos', d: 'Capacitación y carga de dotación', desde: 7, hasta: 10, color: VERDE, sem: 'S14–S20' },
  { n: '6 · Contabilidad en producción', d: 'Libro diario y estados financieros', desde: 9, hasta: 11, color: OCRE, sem: 'S18–S22' },
  { n: '7 · Preparación ISO 9000', d: 'Control documental y auditoría interna', desde: 10, hasta: 12, color: VERDE, sem: 'S20–S24' },
]

const celdaQ = (llena, color) =>
  new TableCell({
    width: { size: ANCHO_Q, type: WidthType.DXA },
    shading: llena ? { type: ShadingType.CLEAR, fill: color } : undefined,
    margins: { top: 60, bottom: 60, left: 40, right: 40 },
    children: [new Paragraph({ spacing: { after: 0 }, children: [] })],
  })

S(
  h1('10', 'Carta Gantt de implementación'),
  lede('Seis meses, siete fases. Las semanas son estimaciones de trabajo, no compromisos contractuales: dependen de la disponibilidad de la contraparte para validar.'),
  new Table({
    columnWidths: [ANCHO_FASE, ...Array(QUINCENAS).fill(ANCHO_Q)],
    width: { size: ANCHO_FASE + ANCHO_Q * QUINCENAS, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINEA },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINEA },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'EDF1EC' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: ANCHO_FASE, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: GRIS },
            margins: { top: 90, bottom: 90, left: 130, right: 130 },
            children: [new Paragraph({ spacing: { after: 0 }, children: [t('FASE', { size: 16, bold: true, color: TINTA_SUAVE, characterSpacing: 20 })] })],
          }),
          ...[1, 2, 3, 4, 5, 6].map((m) =>
            new TableCell({
              columnSpan: 2,
              width: { size: ANCHO_Q * 2, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: GRIS },
              margins: { top: 90, bottom: 90, left: 40, right: 40 },
              children: [new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.CENTER, children: [t(`Mes ${m}`, { size: 16, color: TINTA_SUAVE, font: DATO })] })],
            }),
          ),
        ],
      }),
      ...fases.map((f) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: ANCHO_FASE, type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 130, right: 130 },
              children: [
                new Paragraph({ spacing: { after: 20 }, children: [t(f.n, { size: 19, bold: true })] }),
                new Paragraph({ spacing: { after: 0 }, children: [t(f.d, { size: 16, color: TINTA_SUAVE })] }),
                new Paragraph({ spacing: { before: 20, after: 0 }, children: [t(f.sem, { size: 15, font: DATO, color: f.color, bold: true })] }),
              ],
            }),
            ...Array.from({ length: QUINCENAS }, (_, i) => celdaQ(i + 1 >= f.desde && i + 1 <= f.hasta, f.color)),
          ],
        }),
      ),
    ],
  }),
  espacio(140),
  p([
    t('■ ', { color: VERDE, bold: true }), t('Construcción y despliegue      ', { size: 18, color: TINTA_SUAVE }),
    t('■ ', { color: OCRE, bold: true }), t('Validación con datos reales      ', { size: 18, color: TINTA_SUAVE }),
    t('■ ', { color: CRITICO, bold: true }), t('Ruta crítica', { size: 18, color: TINTA_SUAVE }),
  ]),

  h2('10.1  Qué contiene cada fase'),
  tabla(
    ['Fase', 'Entregable', 'Quién participa', 'Hito de cierre'],
    [
      ['1 · Validación de maestros', 'Mapeo de cuentas confirmado, carencias cargadas por producto, calibración medida en los cuatro estanques', 'Contabilidad y jefes de campo', 'Maestros firmados'],
      ['2 · Servidor y respaldo', 'Base de datos, acceso multiusuario, respaldo automático diario, permisos validados en el servidor', 'Desarrollo', 'Dos personas trabajando a la vez'],
      ['3 · Piloto en Buin', 'Tarja y combustible registrados en terreno durante un mes completo', 'Administrador y jefe de campo de Buin', 'Un mes sin volver al Excel'],
      ['4 · Cierre paralelo', 'Un cierre mensual hecho en ambos sistemas, comparando resultado', 'Contabilidad', 'Diferencia explicada y aceptada'],
      ['5 · Despliegue', 'Dotación cargada y capacitación en los cuatro campos', 'Todos los campos', 'Cuatro campos registrando'],
      ['6 · Contabilidad en producción', 'Libro diario del ejercicio y estados financieros emitidos desde el sistema', 'Contabilidad y contador externo', 'Estados financieros aceptados'],
      ['7 · Preparación ISO', 'Control de versiones documental, registro de no conformidades, auditoría interna', 'Gerencia y control interno', 'Primera auditoría interna'],
    ],
    [2200, 3400, 2000, 1760],
    { size: 17 },
  ),
  espacio(200),
  recuadro(
    'Sobre el calendario',
    'Conviene que la fase 5 no caiga en cosecha. Si el despliegue coincide con el peak de actividad, el registro diario se abandona y el sistema queda vacío. Ajustar el inicio según el calendario agrícola es más importante que empezar pronto.',
  ),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 11 ── */
S(
  h1('11', 'Riesgos y supuestos declarados'),
  lede('Lo que se asumió al construir y debe confirmarse antes de operar. Se declara explícitamente para que nadie lo descubra después.'),
  tabla(
    ['Supuesto', 'De dónde viene', 'Cómo se confirma', 'Riesgo'],
    [
      ['El mapeo de cuentas analíticas a financieras', 'Seis cruces del asiento real de junio 2026; el resto por criterio contable', 'Revisión de la contadora sobre la tabla de mapeo', 'Medio'],
      ['Calibración de Graneros, Los Lirios y Chumaco', 'Se replicó la de Buin: 11,5 cm equivalen a 100 litros', 'Medir físicamente cada estanque', 'Alto'],
      ['Carencias por categoría de producto', 'Valores conservadores de referencia, no de etiqueta', 'Cargar la carencia real producto por producto', 'Alto'],
      ['Desglose del haber en el asiento de sueldos', '2% de impuesto único, el resto leyes sociales', 'Comparar contra una liquidación real', 'Medio'],
      ['La temporada agrícola parte en mayo', 'No estaba escrito en ningún archivo', 'Confirmar con gerencia', 'Bajo'],
      ['Precios de referencia de insumos y EPP', 'Estimados por categoría', 'Cargar precios reales de compra', 'Medio'],
    ],
    [2500, 2900, 2560, 1400],
    { size: 17 },
  ),

  h2('11.1  Sobre el control de acceso'),
  recuadro(
    'El login organiza el trabajo, no protege los datos',
    [
      'Mientras el sistema corra sólo en el navegador, cualquiera con conocimientos básicos puede leer o alterar la información sin pasar por la pantalla de acceso. Las contraseñas se guardan con hash y sal, nunca en texto plano, pero eso sólo evita que se lean de un vistazo.',
      [
        t('Sirve igualmente para que cada persona vea sólo lo suyo, para dejar registro de quién hizo qué y para tener el modelo listo. ', { size: 20, color: TINTA_SUAVE }),
        t('La seguridad real llega con la fase 2', { size: 20, bold: true }),
        t(', donde estas mismas reglas se validan en el servidor.', { size: 20, color: TINTA_SUAVE }),
      ],
    ],
    CRITICO, CRITICO_CLARO,
  ),

  h2('11.2  Datos de demostración'),
  p([
    t('Los '), t('maestros son reales', { bold: true }),
    t(': plan de cuentas, cuarteles, cargos, especies, variedades, productos de bodega y los 319 movimientos del estanque de Buin. Los '),
    t('movimientos de personal, tarja y remuneraciones son simulados', { bold: true }),
    t(' para poder evaluar el sistema de inmediato. Existe una opción que los borra y deja los maestros listos para cargar datos productivos.'),
  ]),
  new Paragraph({ children: [new PageBreak()] }),
)

/* ── 12 ── */
S(
  h1('12', 'Decisiones que corresponden a la empresa'),
  lede('No son tareas técnicas: son definiciones que condicionan el resto del proyecto.'),
  tabla(
    ['Decisión', 'Por qué importa'],
    [
      ['1 · ¿Se invierte en servidor?', 'Es la decisión que gobierna todo. Sin ella el sistema no es multiusuario ni tiene respaldo, y cada avance queda expuesto. Define si el proyecto avanza o queda como herramienta de una sola persona.'],
      ['2 · ¿El contador externo participa?', 'El sistema exporta en el formato que él ya usa, pero conviene acordar con él el traspaso. Si coopera, se elimina doble digitación; si no, el sistema igual funciona pero con menos beneficio.'],
      ['3 · ¿Quién registra la tarja en terreno?', 'El sistema supone que el jefe de campo registra a diario. Si eso no ocurre, la carga vuelve a la oficina y se pierde la mitad del valor. Hay que definir responsable y horario.'],
      ['4 · ¿Cuándo se parte?', 'El despliegue no debiera coincidir con cosecha. Conviene fijar la fecha de inicio en función del calendario agrícola de los cuatro campos.'],
      ['5 · ¿Se miden los estanques?', 'La calibración de tres de los cuatro campos es un supuesto. Medirlos es barato y evita arrastrar diferencias como las que hoy tiene Buin.'],
      ['6 · ¿Se completan los ingredientes activos?', '65 productos sin ese dato. Es trabajo de digitación desde las etiquetas, y sin él el registro de aplicaciones no sirve ante una certificadora.'],
    ],
    [3200, 6160],
    { size: 19 },
  ),

  h2('12.1  Recomendación'),
  p('Partir por las fases 1 y 2 en paralelo. Mientras el desarrollo levanta el servidor, la contraparte valida maestros, mide estanques y completa ingredientes activos. Son seis semanas de trabajo que no compiten entre sí y que dejan el sistema listo para un piloto real en Buin.'),
  p([
    t('El piloto debe durar '), t('un mes completo sin volver al Excel', { bold: true }),
    t('. Es la única forma de saber si el registro diario se sostiene en terreno, que es el supuesto del que depende todo lo demás.'),
  ]),
  espacio(300),
  new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: TINTA, space: 10 } },
    children: [
      t('SIGA · Sistema Integrado de Gestión Agrícola — Agrícola El Bosque Ltda. Informe preparado sobre los siete archivos entregados por la empresa. Las cifras de verificación provienen de pruebas ejecutadas sobre los datos reales de las planillas; los supuestos declarados en la sección 11 están pendientes de confirmación.', { size: 16, color: TINTA_SUAVE }),
    ],
  }),
)

/* ══════════════════════════════════════════════════════════
   DOCUMENTO
   ══════════════════════════════════════════════════════════ */
const numeracion = (ref) => ({
  reference: ref,
  levels: [{
    level: 0,
    format: LevelFormat.DECIMAL,
    text: '%1.',
    alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 340, hanging: 240 } }, run: { bold: true, color: TINTA_SUAVE, size: 19 } },
  }],
})

const doc = new Document({
  creator: 'SIGA',
  title: 'Informe de propuesta · SIGA · Agrícola El Bosque Ltda.',
  description: 'Informe de propuesta del sistema SIGA',
  styles: {
    default: {
      document: { run: { font: CUERPO, size: 21, color: TINTA } },
      heading1: { run: { font: CUERPO, size: 30, bold: true, color: TINTA } },
      heading2: { run: { font: CUERPO, size: 23, bold: true, color: TINTA } },
      heading3: { run: { font: CUERPO, size: 17, bold: true, color: TINTA_SUAVE } },
    },
  },
  numbering: {
    config: [
      {
        reference: 'vinetas',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '▪',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 340, hanging: 220 } }, run: { color: VERDE } },
        }],
      },
      numeracion('fo'), numeracion('de'), numeracion('op'), numeracion('am'),
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // carta
        margin: { top: 1420, right: 1440, bottom: 1420, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            spacing: { after: 0 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA, space: 6 } },
            children: [
              t('SIGA · Informe de propuesta', { size: 15, color: TINTA_SUAVE, font: DATO }),
              t('\t\tAgrícola El Bosque Ltda.', { size: 15, color: TINTA_SUAVE, font: DATO }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 15, color: TINTA_SUAVE, font: DATO }),
            ],
          }),
        ],
      }),
    },
    children: [...portada, ...cuerpo],
  }],
})

Packer.toBuffer(doc).then((buf) => {
  const salida = process.argv[2] || 'informe.docx'
  fs.writeFileSync(salida, buf)
  console.log('Generado:', salida, (buf.length / 1024).toFixed(0) + ' KB')
})
