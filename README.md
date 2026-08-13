# SIGA · Sistema Integrado de Gestión Agrícola
### Agrícola El Bosque Ltda.

Reemplazo del ecosistema de planillas Excel por un sistema único, con los maestros
reales de la empresa y la lógica de costeo que hoy vive en macros.

```bash
npm install
npm run dev     # http://localhost:5180
npm run build   # build de producción en dist/
```

---

## El problema que resuelve

Hoy existen **dos fuentes de información independientes**: la contabilidad externa
(tributaria, en Nubox) y las planillas internas (operativas). Los 4 campos están
cargados en Nubox como empresas distintas cuando en realidad son centros de costo
del mismo negocio. El resultado es duplicidad de esfuerzo, ausencia de cierres
integrados y ningún dato confiable de costo real por hectárea.

SIGA une ambos mundos en una sola base: la tarja alimenta el costeo, el costeo
alimenta el asiento contable, y el asiento sale en el formato que el contador ya usa.

---

## Módulos

| Módulo | Qué hace | Qué reemplaza |
|---|---|---|
| **Dashboard** | Costo por jornada, por hectárea, por labor y por especie. Alertas de control. | Consolidados manuales de gerencia |
| **Tarja digital** | Grilla mensual por trabajador × día. Labor N6/N7, centro de costo, hora de llegada, tipo de día. | Tarja Buin / Graneros / Chumaco / Los Lirios (4 formatos distintos → 1) |
| **Costos y cierre** | Motor de distribución + libro de remuneraciones + asiento con 13 dimensiones. | Macro y Power Query de distribución |
| **Contabilidad** | Libro Diario, control de asientos, Libro Mayor, Balance de 8 columnas, Estado de Resultados y Balance General. | Sistema_contable_AEB_V01.xlsx completo |
| **Personal** | Ficha de trabajador, cargo → cuenta contable, datos bancarios y de EPP. | Ficha Ingreso Trabajador AEB (papel) |
| **Combustible** | Movimientos de estanque, control físico, prorrateo de diferencias y consumo por CC, labor, vehículo y chofer. | Planilla de control de petróleos |
| **Bodega e insumos** | Stock de agroquímicos y fertilizantes, conteo físico con ajuste, registro de aplicaciones M2-008-F004 y control de carencias. | Hojas `Stock sept LL` / `Stock Sept CH` y el formulario en papel |
| **Prevención y EPP** | Stock, matriz EPP por cargo, entregas firmadas, capacitaciones, charlas diarias. | Control manual de EPP que nunca cuadra |
| **Pack motivacional** | Semillas por asistencia, puntualidad, EPP y rendimiento. Catálogo de canjes. | No existía — estaba aprobado sin registros |
| **Campos y cuarteles** | Base operativa: superficie, especies, variedades, riego, plantas por CC. | Tabla_BaseOperativa_Agricola |
| **Plan de cuentas** | Árbol N1–N5 navegable + constructor de imputación de 13 niveles. | Maestro_Plan_de_Cuentas.xlsx |
| **Reportes** | Exportación a Excel e importación del libro de remuneraciones de Nubox. | Envíos manuales al contador y al banco |
| **Usuarios y acceso** | Roles, permisos por módulo, campos asignados y bitácora de quién hizo qué. | No existía — el archivo lo abría cualquiera |

---

## El plan de cuentas de 13 niveles

Implementado tal como está documentado en *Estructura del Plan de Cuentas*:

```
N1–N4    Base contable clásica          ACTIVO › CIRCULANTE › DISPONIBLE › CAJA
N5       Clasificación extra            FERTILIZANTES, CONTRATISTA, SUELDOS_ADM
N6–N7    Labores agrícolas              PODA › CHAPODA
N8–N12   Información productiva         Etapa · Especie · Variedad · Campo · Temporada
N13      Centro de costo                SANTINA21, DZ27 — consolida todo lo anterior
```

Desde N6 la cuenta **deja de llenarse a mano**: la alimentan RRHH, insumos y
operaciones. Cuando una dimensión no aplica, queda en `000000`.

Un código generado se ve así:

```
4126 / 1-3-0-0-0 / 1-5-7
 │      │           └── campo · temporada · centro de costo
 │      └────────────── labor general · específica · etapa · especie · variedad
 └───────────────────── cuenta contable N4
```

---

## Motor de distribución de costo

Está en [`src/lib/motorCostos.ts`](src/lib/motorCostos.ts). Reglas implementadas:

1. **Trabajador agrícola** → base = `sueldo base ÷ 30 × días del mes`
2. **Administrativo (ADM)** → base = `sueldo base ÷ 30 × días trabajados`, imputado
   a `SUELDOS_ADM` (4126) pero integrado al costo empresa
3. **Con libro de remuneraciones cargado** → la base real pasa a ser
   `total haber − asignación familiar`. Es el número que cuadra con contabilidad;
   el devengo teórico queda sólo como proyección de pre-cierre
4. **Vacaciones** → jornada válida, se redistribuye sobre lo efectivamente trabajado
5. **SIN_LABOR** → no cuenta como jornada real, no diluye el costo
6. **Fin de semana trabajado** → jornada efectiva, sin excepción
7. **Trato** → convertido a equivalencia de jornada real, porque el trabajador sí
   asistió. Mantiene la trazabilidad de asistencia, licencias y seguridad

El reparto es proporcional a las jornadas y la última línea absorbe el redondeo,
de modo que **el asiento cuadra al peso** con la base de origen.

### Verificación

Prueba de integración ejecutada sobre el set de demostración (Buin, julio 2026):

```
Base de cálculo   : LIBRO
Trabajadores      : 18
Jornadas          : 391,14
Total distribuido : $18.051.250
Base esperada     : $18.051.250
Desvío            : 0            ✓ cuadra al peso
Líneas SIN_LABOR  : 0            ✓ excluidas del reparto
Líneas incompletas: 0            ✓ 13 dimensiones en todas
```

---

## Contabilidad de doble entrada

Implementa `Sistema_contable_AEB_V01.xlsx` completo, con una diferencia de fondo:
**no hay fórmulas que romper**. Todo se recalcula desde el Libro Diario, que es el
único punto de ingreso.

```
Libro Diario ──┬── Control de asientos (Debe = Haber)
               ├── Libro Mayor (por cuenta, con saldo acumulado)
               ├── Balance de 8 columnas
               ├── Estado de Resultados
               └── Balance General
```

### Dos planes de cuentas que conviven

| Plan | Códigos | Para qué | Manda en |
|---|---|---|---|
| **Financiero** | 1.x – 5.x (46 cuentas) | Lo que entiende el contador y exige el SII | Balance y Estado de Resultados |
| **Analítico** | N1 – N13 | Costo por labor, cuartel, especie y hectárea | Gestión y decisiones |

Cada línea del Libro Diario lleva **los dos**. Ése es el puente entre la contabilidad
tributaria externa y las planillas operativas internas — las dos fuentes que hoy
nadie concilia.

### El botón que cierra el círculo

En *Costos y cierre → Contabilizar*, la distribución de mano de obra se convierte en
un asiento real:

```
DEBE   5.1  Costo de ventas .......... una línea por cada combinación de las 13 dimensiones
HABER  2.7  Leyes sociales por pagar
       2.5  Impuestos por pagar (impuesto único 2ª categoría)
       1.71 Anticipos de sueldos (rebaja el anticipo ya entregado)
       2.4  Remuneraciones por pagar (líquido a transferir)
```

El líquido se calcula por diferencia, de modo que **el asiento cuadra al peso por
construcción**. La estructura está tomada del asiento real de junio 2026 que ya existe
en el archivo de la empresa.

### Verificación contable

Prueba de integración sobre el set de demostración (9 asientos, ejercicio 2026):

```
Asientos descuadrados              : 0             ✓
Σ Debe = Σ Haber                   : $1.027.301.500 ✓
Balance 8 col · sumas iguales      : $1.027.301.500 ✓
Activo + Pérdidas = Pasivo + Gan.  : $942.435.500   ✓
Balance General · descuadre        : 0             ✓
EERR coincide con 8 columnas       :               ✓
Costo motor = costo en cuenta 5.1  : $53.135.500    ✓
Líneas de costo con N6/N11/N13     : 931 de 931     ✓
```

La última línea es la que importa: **el mismo peso aparece en los dos mundos**, con
las 13 dimensiones intactas dentro del asiento contable.

---

## Control de combustible

Implementa las reglas escritas en la hoja *Recordatorio* de la planilla de petróleos:

1. Control físico del estanque al menos a fin de cada mes. En el control los litros
   van en cero y se registra el stock visible.
2. Si hay diferencia entre lo visible y lo estimado, el ajuste se hace el primer día
   del mes siguiente y se **prorratea entre los centros de costo** según lo que cada
   uno consumió en el período (regla de tres).
3. Diferencia positiva se registra como entrada; negativa, como salida.
4. Todo ajuste queda identificado como tal en las observaciones.

La medición con vara se convierte a litros con la calibración del estanque
(11,5 cm = 100 litros en Buin), y el consumo se analiza por centro de costo, labor,
vehículo, chofer y especie.

### Hoja de conteo — los 5 pasos

Implementa `HOJA CONTEO LITROS PETROLEO` como un asistente mensual:

```
PASO 1  Entradas    saldo inicial + compras = total ingresos
PASO 2  Salidas     suma de cada entrega registrada, una a una
PASO 3  Chequeo     contador final − contador inicial debe ser IGUAL
                    a la suma de salidas del paso 2
PASO 4  Resultado   total entradas − total salidas = saldo contable,
                    que se compara con el saldo visible del estanque
PASO 5  Lectura     saldo contable − saldo visible:
                      negativo → hay más petróleo del que indica la máquina
                                 → calibrar
                      positivo → hay menos petróleo → mal registro, entrega
                                 incompleta del proveedor o fugas en el campo
```

El **paso 3 es el control que la planilla de inventario no tenía**: cruza el registro
manual contra el contador mecánico del estanque. Si no cuadran, hay entregas sin
registrar, y ningún ajuste posterior va a corregir eso — el sistema lo avisa antes
de dejar prorratear.

### Dos detalles que importan

**El orden que manda es el de registro, no el de la fecha.** Un control y los ajustes
que lo siguen suelen llevar la misma fecha. Si el corte se hiciera por fecha, el
estimado "al momento del control" incluiría movimientos posteriores y la diferencia
saldría mal. La planilla funciona por orden de fila, y aquí se respeta esa semántica.

**El prorrateo usa salidas netas**, como lo llama la propia hoja. Una calibración se
registra como salida y devolución del mismo volumen: no es combustible usado y debe
compensarse dentro del centro de costo antes de repartir.

### Verificación contra la planilla real

Se importaron los **319 movimientos reales del estanque de Buin** desde junio 2024,
con sus 27 controles físicos, y se comparó el motor contra los números del Excel:

```
Stock estimado         : -1.840 L   (planilla: -1840)   ✓
Visible último control :    200 L   (planilla: 200)     ✓
Diferencia             : +2.040 L   (planilla: 2040)    ✓
Total entradas         : 11.672 L   (planilla: 11672)   ✓
Total salidas          : 13.512 L   (planilla: 13512)   ✓
Controles registrados  :     27     (planilla: 27)      ✓
Calibración 8,1 cm     :  70,43 L   (planilla: 70,43)   ✓

Prorrateo del control 2024-06-19 (diferencia -19 L):
  SANTINA24    46 L → -9,6 L   (planilla: -9,6)         ✓
  GENERAL BU   45 L → -9,4 L   (planilla: -9,4)         ✓
```

Y la hoja de conteo reproduce sus 12 valores del ejemplo:

```
PASO 1  saldo inicial 292 · compras 701 · total 993          ✓
PASO 2  suma de 7 entregas = 260                             ✓
PASO 3  267.363 − 267.103 = 260 · cuadra con los registros   ✓
PASO 4  saldo contable 733 · saldo visible 890               ✓
PASO 5  diferencia -157 → CALIBRAR                           ✓
```

Sobre los datos reales de Buin, el análisis de los 25 períodos arroja que **24
requieren calibración** y 4 tienen descuadre entre el contador y los registros.

El asiento de consumo cuadra al peso y conserva las dimensiones N9/N11/N13 en todas
sus líneas.

---

## Bodega y aplicaciones fitosanitarias

Dos cosas que en el Excel eran hojas separadas y aquí son una sola:

**El conteo físico** replica el cuadro de `Stock sept LL` / `Stock Sept CH` —stock según
entradas y salidas · stock real · ajuste— y registra la diferencia como movimiento, de
modo que el sistema queda igual a lo que hay en bodega y queda constancia de la
corrección.

**El registro de aplicaciones** implementa el formulario **M2-008-F004** completo:
fecha, variedad, cuartel, plaga, producto comercial, ingrediente activo, dosis/100 L,
dosis/ha, mojamiento, carencia y cantidad de producto.

### Lo que cambia respecto a la planilla

Una aplicación **descuenta su producto de bodega automáticamente**. En el Excel eran
dos registros independientes, y por eso el stock nunca cuadraba. Además:

- Si no alcanza el stock, el sistema **no deja registrar la aplicación** y dice cuánto falta.
- La cantidad se calcula sola: `dosis/ha × ha`, o `dosis/100L × mojamiento × ha ÷ 100`.
  Si vienen ambas manda la dosis por hectárea, que es la que fiscaliza el SAG.
- Cada aplicación genera su **carencia**: el sistema bloquea el cuartel y muestra desde
  qué fecha se puede cosechar. Cosechar antes invalida la certificación.

### Verificación

```
Productos importados             : 108 (43 con ingrediente activo)   ✓
Productos con stock negativo     : 0                                 ✓
Aplicaciones con salida de bodega: 19 de 19                          ✓
Cantidad descontada = dosis × ha : ✓
Dosis/ha 2,5 × 8 ha              = 20                                ✓
Dosis/100L 0,8 · 1200 L/ha · 5 ha = 48                               ✓
Carencia 14 d desde 2026-08-01   → cosechable 2026-08-15             ✓
Ajuste por conteo deja la diferencia en cero                         ✓
Asiento de insumos cuadra, con N5 y N13 en todas las líneas          ✓
```

Los **43 ingredientes activos** que faltan quedan marcados en pantalla: sin ese dato el
registro no sirve ante una certificadora, y el sistema lo dice en vez de dejarlo pasar.

---

## Control de acceso

> ⚠️ **Este login organiza el trabajo, no protege los datos.**
> Mientras el sistema corra sólo en el navegador, cualquiera con conocimientos
> básicos puede abrir las herramientas de desarrollo y leer o alterar la
> información sin pasar por la pantalla de acceso. Las contraseñas se guardan
> con hash SHA-256 y sal por usuario —nunca en texto plano—, pero eso sólo evita
> que se lean de un vistazo. **La seguridad real llega cuando haya servidor**, que
> es donde estas mismas reglas deben validarse.

Sirve igualmente para tres cosas concretas: cada persona ve sólo lo suyo, queda
registro de quién hizo qué, y el modelo queda listo para el backend.

### Cinco roles

| Rol | Ve | Edita |
|---|---|---|
| **Administrador** | Todo | Todo, incluidos usuarios y bitácora |
| **Gerencia** | Todos los informes y campos | Sólo el pack motivacional |
| **Contabilidad** | Todo salvo usuarios | Costos, contabilidad, tarja, personal, plan de cuentas |
| **Administrador de campo** | Su campo | Tarja, combustible, bodega, prevención |
| **Jefe de campo** | Su campo | Tarja, combustible, prevención |

Los roles de terreno quedan **amarrados a sus campos**: el selector de la barra
superior no les ofrece los demás.

### Lo que incluye

- Bloqueo por **5 intentos fallidos** durante 5 minutos
- **Cambio de clave obligatorio** en el primer ingreso, con medidor de fortaleza
- **Sesión con vencimiento** a las 8 horas, que se renueva con la actividad —los
  equipos en el campo se comparten
- Guarda de ruta: escribir la dirección a mano no sirve, el módulo no se monta
- **Bitácora** con quién, cuándo, qué acción y en qué módulo, exportable a Excel

Los mensajes de error no revelan si el usuario existe: siempre dicen lo mismo.

---

## Datos

Los **maestros son reales**, extraídos de `Maestro_Plan_de_Cuentas_muestra.xlsx`:

- 141 cuentas analíticas · 46 cuentas financieras · 124 cuarteles de base operativa · 40 centros de costo
- 108 productos de bodega con ingrediente activo · 319 movimientos reales del estanque de Buin
- 14 cargos con su cuenta N4 · 7 especies · 22 variedades · 47 unidades de medida
- 12 labores generales con su desglose de labores específicas

Los **movimientos son simulados** (dotación, tarja, remuneraciones, EPP) para poder
evaluar el sistema de inmediato. En *Reportes → Limpiar todo* se borran y queda listo
para cargar datos productivos, conservando los maestros.

La persistencia es `localStorage` del navegador. Para uso multiusuario en los 4 campos
hay que agregar un backend; el modelo de dominio ya está preparado para eso.

---

## Exportaciones

| Archivo | Hojas | Destino |
|---|---|---|
| `Asiento_MO_*.xlsx` | Resumen · Asiento consolidado · Detalle por trabajador · Advertencias | Contabilidad externa |
| `Planilla_Contador_*.xlsx` | Planilla contador (24 col.) · Asistencia detallada | Contador · Nubox |
| `Nomina_Banco_*.xlsx` | Nómina banco · Anticipos · Control | Banco |
| `Libros_Contables_*.xlsx` | Config · Libro_Diario · Control_Asientos · Libro_Mayor · Balance_8_Columnas · Estado_Resultados · Balance_General | Contador · SII |
| `Bodega_y_Aplicaciones_*.xlsx` | Stock · Registro aplicaciones · Carencias vigentes · Movimientos · Maestro productos | SAG · certificadoras |
| `Control_Combustible_*.xlsx` | Control estanques · Hoja de conteo (5 pasos) · Inventario · Resumen CC / Labor / Vehículo / Chofer · Serie mensual | Administración de campo |
| `Reporte_Prevencion_*.xlsx` | Stock EPP · Entregas · Capacitaciones · Charlas | ACHS · certificadoras |
| `Maestros_SIGA_*.xlsx` | PlanCuentas · BaseOperativa | Respaldo · auditoría |

**Importación**: *Reportes → Importar libro de remuneraciones* lee el export de Nubox,
detecta las columnas por nombre aproximado, cruza por RUT y muestra una previsualización
antes de confirmar.

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Recharts · SweetAlert2 ·
SheetJS · lucide-react

Diseño: *Data-Dense Dashboard* — verde agrícola sobre ámbar de gestión, tipografía
Fira Sans / Fira Code, números tabulares en toda columna de dinero, modo claro y
oscuro con contraste AA, y foco visible en todo elemento interactivo.

---

## Camino hacia ISO 9000

La estructura ya soporta lo que exige el control documental:

- Trazabilidad completa de asistencia (quién, cuándo, qué labor, en qué cuartel)
- Registro firmado de entrega de EPP con control de stock
- Historial de capacitaciones por trabajador con fecha de vencimiento
- Charlas de seguridad diarias con riesgos, medidas y asistentes

Falta agregar: control de versiones documental, registro de no conformidades y
auditorías internas.
# Agr-cola-El-Bosque
