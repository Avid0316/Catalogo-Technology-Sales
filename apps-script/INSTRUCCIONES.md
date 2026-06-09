# 📋 Catálogo TechnologySales — API completa

Convierte tu **reporte del sistema** en catálogo web usando tus diccionarios.

```
Crudo  ──[Diccionarios]──►  Inventario  ──[+ Precios]──►  JSON  ──►  Sitio web
        construirInventario()              doGet()
```

## 🗂️ Hojas necesarias

| Hoja | Para qué |
|---|---|
| **Crudo** | Pegas el reporte del sistema tal cual |
| **Diccionario_Modelos** | `Texto a buscar · Marca · Modelo · Categoria · Chip` |
| **Diccionario_Almacenamientos** | `Texto a buscar · Almacenamiento correcto` |
| **Diccionario_Colores** | `Texto a buscar · Color correcto` (largos primero) |
| **Inventario** | **Se genera solo** (no la edites a mano) |
| **Precios** | `Marca · Modelo · Capacidad · Chip · Estado · Precio Mayorista · Precio Reventa · Precio Cliente Final` |
| **Imagenes** | `Marca · Modelo · Imagen` (una imagen general por modelo) |
| **Equipos** *(opcional)* | Venta por unidad: un teléfono por fila con su batería, ciclos, garantía y precios propios. Ver `Plantilla_Equipos.xlsx`. Aparecen en la categoría **"Equipos individuales"**. |
| **Movimientos** *(se crea sola)* | Historial de cambios de sucursal. Cada vez que **Construir inventario**, compara con el estado anterior y registra los movimientos aquí. No la edites a mano. |
| **Descuadres** *(se crea sola)* | Equipos individuales que no concuerdan con el sistema (están en `Equipos` pero el sistema ya no los tiene en esa sucursal). Menú **TechnologySales ▸ Revisar descuadres** o automático al construir. |

## 📦 Historial de movimientos (hoja "Movimientos")

Al **Construir inventario**, el sistema compara con el estado anterior y registra en la
hoja **`Movimientos`**:
- **Stock normal:** si una sucursal baja y otra sube → `Movimiento`; si cambia el total → `Cambio` (venta/ingreso).
- **Equipos individuales (IMEI):** si cambia su sucursal → `Individual` (Desde → Hacia); altas/bajas como `Ingreso`/`Salida`.

> La primera vez solo guarda la "foto" base (no registra todo como movimiento). De ahí en
> adelante, cada reconstrucción registra solo lo que cambió.

> Los diccionarios y la hoja Precios vienen **pre-generados** en
> `Estructura_PreGenerada.xlsx` (298 modelos, 27 capacidades, 403 llaves de precio).

## 🔄 Uso de cada día

1. Pega el reporte del sistema en **`Crudo`**.
2. Menú **TechnologySales ▸ Construir inventario**.
   - Llena la hoja **`Inventario`** aplicando los diccionarios.
   - Si algún producto **no está en el diccionario de modelos**, te avisa con ejemplos
     para que lo agregues (una línea) y vuelvas a construir.
3. (Si cambiaste precios, solo edita la hoja **`Precios`**.)

## 🌐 Publicar

**Implementar ▸ Gestionar implementaciones ▸** editar la existente (así la URL no cambia),
o **Nueva implementación** la primera vez:
- Tipo **Aplicación web** · Ejecutar como **Yo** · Acceso **Cualquier persona**.
- Copia la URL `…/exec` y pégala en `API_URL` dentro de `index.html`.

## 📦 Qué entrega el JSON

| Campo | Origen |
|---|---|
| Categoria, Marca, Modelo, Capacidad, Color | Diccionarios |
| Chip | Columna **Chip** del Diccionario_Modelos; si está vacía, se detecta del nombre |
| Sucursal, Cantidad | Disponible = Virtual + Consignación |
| Consignacion | Cuánto de lo disponible es consignación (solo interno) |
| Comprometido | En proforma (solo personal interno) |
| Estado | Grupo (Nuevo, Usado, Open Box, En Caja) |
| Precio Mayorista / Reventa / Publico | Hoja Precios (Publico = Cliente Final) |
| Imagen | Hoja **Imagenes** por Marca+Modelo (una por modelo) |

## 💾 Guardar precios desde la web (doPost)

El panel de admin del sitio guarda precios directo en la hoja `Precios`. Para que
funcione, el Apps Script incluye `doPost`, que **valida que seas admin** (con tu
sesión de Firebase) antes de escribir.

- Edita la lista **`ADMIN_EMAILS`** (arriba del archivo) con los correos que pueden
  guardar precios. Usa el **mismo correo con el que inicias sesión en la web**.
- ⚠️ **Cada vez que cambies el código debes RE-DESPLEGAR** para que el `doPost` nuevo
  tome efecto: **Implementar ▸ Gestionar implementaciones ▸** editar la existente
  ▸ Versión: **Nueva** ▸ Implementar. (La URL no cambia.)

> Si al guardar sale *"Failed to fetch"* o *"no tiene doPost"*, casi siempre es que
> faltó **re-desplegar** tras pegar el código.

## ⚠️ Notas importantes

- **La llave es `Marca + Modelo + Capacidad + Chip + Estado`** y debe ser **idéntica** en
  `Inventario` y en `Precios`. Como ambas salen de los mismos diccionarios, coincide automáticamente.
  Así el precio puede variar según el chip (eSIM, 1 SIM, Dual SIM) **y el estado** (Nuevo, Usado, Open Box, En Caja).
  ⚠️ La hoja `Precios` **debe** tener las columnas **Chip** y **Estado** (usa el Excel pre-generado).
- Los **agotados no se envían** (Disponible y Comprometido en 0).
- El sitio ya muestra **Consignación** y **En proforma (Comprometido)** en el detalle,
  **solo a roles internos** (admin, asesor, vendedor).
- Pendiente a futuro: el **filtro de Chip** (la API ya entrega el dato).
