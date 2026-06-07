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
| **Diccionario_Modelos** | `Texto a buscar · Marca · Modelo · Categoria` |
| **Diccionario_Almacenamientos** | `Texto a buscar · Almacenamiento correcto` |
| **Diccionario_Colores** | `Texto a buscar · Color correcto` (largos primero) |
| **Inventario** | **Se genera solo** (no la edites a mano) |
| **Precios** | `Marca · Modelo · Capacidad · Precio Mayorista · Precio Reventa · Precio Cliente Final · Imagen` |

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
| Chip | Detectado del nombre (eSIM / Dual SIM / 1 SIM) |
| Sucursal, Cantidad | Disponible = Virtual + Consignación |
| Comprometido | En proforma (solo personal interno) |
| Estado | Grupo (Nuevo, Usado, Open Box, En Caja) |
| Precio Mayorista / Reventa / Publico | Hoja Precios (Publico = Cliente Final) |
| Imagen | Hoja Precios |

## ⚠️ Notas importantes

- **La llave es `Marca + Modelo + Capacidad`** y debe ser **idéntica** en `Inventario`
  y en `Precios`. Como ambas salen de los mismos diccionarios, coincide automáticamente.
- Los **agotados no se envían** (Disponible y Comprometido en 0).
- El sitio todavía debe: mostrar **Comprometido** solo a roles internos y agregar el
  **filtro de Chip** (siguiente ajuste en `index.html`).
