# Futuro: Sincronización con Google Sheets por bodega

> Estado: **idea aprobada en concepto, aún no implementada**. Cuando el usuario diga que ya toca esta parte, revisar este archivo completo antes de empezar.

## Por qué

El personal de las sucursales ya trabaja el inventario en hojas de cálculo (no tienen ni tendrán acceso al panel admin de la página). El dueño (único admin de la página) quiere que el inventario de la página/BDD siempre refleje lo que hay en esas hojas, y viceversa cuando él agrega/edita productos desde la página.

## Roles (importante — define todo el diseño)

- **Personal de sucursal**: solo tiene acceso a las hojas de cálculo. Ahí edita **stock y precio** de productos que ya existen. **No da de alta productos nuevos** desde la hoja.
- **Admin (el usuario)**: solo tiene acceso a la página. Ahí da de alta productos nuevos, los edita, hace ajustes de precio en lote, ajusta stock por bodega, etc. (todo lo que ya existe hoy en `/pisos/nuevo`, `/pisos/[id]/editar`, Inventario Rápido).

Como cada lado tiene un rol claro y no se traslapan, **no hay conflictos reales de "quién gana"** — son dos caminos de sincronización separados:

1. **Hoja → BDD** (el más común, continuo): el personal cambia stock/precio en la hoja → se refleja en la base de datos → se ve en la página.
2. **Página/BDD → Hoja** (más esporádico: altas nuevas, ediciones del admin, ajustes en lote): lo que pasa en la página también debe aparecer en la hoja correspondiente.

El usuario confirmó que un retraso de **10 a 30 minutos** en la sincronización es aceptable — **no hace falta tiempo real**.

## Estructura de los archivos (confirmada con el usuario)

- **Un archivo de Google Sheets por bodega** (según `WAREHOUSES` en `src/lib/types.ts`: La Playita, Arroyo de Cañas, Lagunita, Plomería, Matriz — probablemente serán 4 o 5 archivos reales dependiendo de cuáles bodegas realmente tengan stock de pisos asignado).
- **Dentro de cada archivo, una pestaña (hoja) por cada marca** que tenga productos en esa bodega — exactamente la misma lógica que ya existe en `src/lib/excelExport.ts` (función `buildInventoryWorkbook` / `buildBrandSheet`) para el export "Por bodega" a Excel.
- **Dentro de cada pestaña**: mismas columnas que el export actual — FORMATO | DESCRIPCIÓN | PIEZAS X CAJA | M² X CAJA | CAJAS EN EXISTENCIA | PRECIO — agrupado/ordenado por formato (tamaño real, ancho×alto) y luego por nombre alfabético. **Reutilizar la misma lógica de agrupamiento y orden ya construida**, solo cambia el destino (Google Sheets API en vez de generar un buffer `.xlsx` para descargar).
- Cada fila necesita una **columna oculta con el ID del producto** (UUID de `products.id`) para que la sincronización sepa exactamente a qué producto corresponde cada fila sin importar si el personal reordena/inserta filas.
- Un mismo producto puede aparecer en varios archivos (uno por cada bodega donde tiene stock vía `product_bodega_stock`), cada aparición se sincroniza de forma independiente para esa bodega específica.

## Enfoque técnico recomendado

- **Nada de tiempo real / triggers de Apps Script / webhooks.** Dado que 10-30 min de retraso es aceptable, basta un **trabajo programado (cron)** — por ejemplo un cron job de Vercel o una función programada — que corra cada cierto intervalo y haga una reconciliación completa en ambos sentidos:
  1. Lee cada hoja de bodega vía la API de Google Sheets.
  2. Compara contra `product_bodega_stock` / `products` en Supabase.
  3. Aplica los cambios que vinieron del lado de la hoja (stock/precio editado por el personal) hacia la BDD.
  4. Regenera/actualiza las filas de la hoja para reflejar altas o ediciones hechas desde la página desde la última sincronización.
- La API de Google Sheets **es gratuita** en este nivel de uso (las cuotas de límite de velocidad son mucho más altas de lo que este proyecto necesitaría).
- Autenticación: crear un proyecto en Google Cloud, habilitar la API de Sheets, crear una **cuenta de servicio**, y compartir cada uno de los archivos de Sheets con el correo de esa cuenta de servicio (acceso de editor).

## Cosas a definir cuando se empiece a construir esto

- Intervalo exacto del cron (¿15 min? ¿30 min?).
- Confirmar cuáles de las 5 bodegas de `WAREHOUSES` realmente necesitan su propio archivo (pueden ser menos de 5 si alguna bodega no maneja pisos).
- Qué pasa si el personal borra una fila completa en la hoja por accidente (¿se ignora, se re-crea en el siguiente sync, se marca como stock 0?).
- Dónde vivirán las credenciales de la cuenta de servicio de Google (variable de entorno nueva, no compartir en el repo).
- Si además de pisos se quiere extender esto a Baños/Adhesivos más adelante (por ahora, todo lo relacionado a bodegas/stock múltiple solo aplica a Pisos).

## Código existente para reutilizar

- `src/lib/excelExport.ts` — lógica de agrupar por marca → por formato → por nombre, ya probada y funcionando para el export a Excel. La generación de las hojas de Google Sheets debe seguir esta misma lógica de agrupamiento/orden.
- `src/actions/products.ts` — `adjustProductBodegaStock`, `replaceProductBodegaStock`, `createProduct`, `updateProduct` — aquí es donde se agregaría el paso adicional de "también actualizar la hoja de Google correspondiente" para la dirección Página → Hoja.
- Tabla `product_bodega_stock` (ver `migration_bodega_stock.sql`) — ya tiene la relación producto↔bodega↔cantidad que este sync necesita.
