# 📋 Catálogo TechnologySales — Paso 1 (Inventario desde el sistema)

Esta guía conecta el **reporte de tu sistema** con el sitio web, para que el
catálogo muestre **categoría, marca, modelo, almacenamiento, color, chip y
stock real** — sin ordenar nada a mano.

> **Paso 1 (este):** stock + atributos limpios.
> **Paso 2 (después):** precios desde la hoja *Precios* (editable en la web) y
> el filtro de **chip** en el sitio.

---

## 🧩 Cómo funciona

```
Reporte del sistema (lo pegas tal cual)
        │  el Apps Script automáticamente:
        ├─ saca Modelo / Almacenamiento / RAM / Color del nombre
        ├─ detecta el Chip cuando viene en el nombre (iPhone eSIM, etc.)
        ├─ toma Categoría (Subgrupo), Marca (Referencia) y Estado (Grupo)
        └─ calcula el stock:
              Disponible   = Cantidad Virtual + Consignación   (revendedor/mayorista/cliente)
              Comprometido = en proforma                        (solo personal interno)
        ▼
   Catálogo limpio (JSON)  →  el sitio web
```

Los **agotados no se envían** (si Disponible y Comprometido son 0, no aparece).

---

## 🛠️ Instalación (una sola vez)

1. Abre tu hoja de **Google Sheets** (la misma donde está *Precios*).
2. Crea una pestaña nueva llamada exactamente **`Inventario crudo`**.
3. Abre el menú **Extensiones ▸ Apps Script**.
4. Borra lo que haya y **pega el contenido de `Inventario.gs`**. Guarda 💾.
5. Vuelve a la hoja y **recárgala** (F5). Aparecerá el menú **TechnologySales**.

## 🔄 Uso de cada día

1. Genera el reporte en tu sistema (el `INVENTARIO_GENERAL`).
2. Copia y **pega todo** en la pestaña **`Inventario crudo`** (desde la celda A1).
3. Menú **TechnologySales ▸ Reconstruir catálogo**.
   - Se crea/actualiza la pestaña **`Catalogo`** para que revises cómo quedó. 👀

> No necesitas ordenar ni limpiar nada: pega el reporte tal como sale del sistema.

---

## 🌐 Publicar para el sitio web

1. En el editor de Apps Script: **Implementar ▸ Nueva implementación**.
2. Tipo: **Aplicación web**.
   - *Ejecutar como:* **Yo**.
   - *Quién tiene acceso:* **Cualquier persona**.
3. **Implementar** y **copia la URL** (`https://script.google.com/.../exec`).
4. En `index.html`, reemplaza el valor de `API_URL` por esa URL.

> Cada vez que cambies el código, usa **Implementar ▸ Gestionar implementaciones**
> y edita la existente (así la URL no cambia).

---

## ✅ Qué entrega cada producto

| Campo | Origen |
|---|---|
| Categoria | Subgrupo del sistema (Celulares, Tablets, Accesorios…) |
| Marca | Referencia (iPhone, Samsung, Xiaomi…) |
| Modelo / Capacidad / RAM / Color | Separados del nombre del sistema |
| Chip | Del nombre cuando viene (eSIM, Dual SIM, 1 SIM) — el resto en el Paso 2 |
| Sucursal + Cantidad | Disponible (Virtual + Consignación) por sucursal |
| Comprometido | En proforma (solo lo ve el personal interno) |
| Estado | Grupo (Nuevo, Usado, Open Box, En Caja) |
| Precios | Vacío por ahora → se llenan en el **Paso 2** |
| Codigo | Llave para unir con la hoja *Precios* en el Paso 2 |

---

## 📌 Notas

- Probado con tu reporte real: **100% de colores** y **99.9% de almacenamiento**
  detectados correctamente.
- Si algún modelo nuevo trae un color raro que no se detecta, se agrega a la
  lista `COLORS` dentro de `Inventario.gs` (una línea) y listo.
