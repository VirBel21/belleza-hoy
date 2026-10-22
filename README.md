# Belleza Hoy · comparador de precios (v0.2, datos reales del 22/10/2026)

`data/productos.json` contiene 59 productos leídos de fichas de Druni y Primor (stock sin confirmar donde la ficha es ambigua). Los datos de ejemplo de la v0.1 están en `data/ejemplo.json`. Moda y virales están vacíos: no hay datos verificados todavía. Mango devolvió 429 al leerla; no se forzó.


Web estática, sin dependencias. Para verla en local:

```bash
python3 -m http.server 8731
```

y abre http://localhost:8731 (el panel está en `/admin.html`). No funciona con doble clic porque carga los JSON con `fetch`.

## Estructura de páginas

| Archivo | Función |
|---|---|
| `index.html` + `app.js` + `styles.css` | Web pública: cabecera, flash, comparador, K-beauty, moda, virales, calendario, lista de seguimiento |
| `admin.html` + `admin.js` | Panel de entrada de datos (borrador en el navegador, descarga el JSON) |
| `data/productos.json` | Todos los precios (un registro por producto y tienda) |
| `data/config.json` | Tiendas y sus URLs fijas, calendario de campañas, categorías, interruptor de afiliados |

## Modelo de datos (`productos.json`)

`meta`: `actualizado` (ISO con zona), `ejemplo` (muestra el aviso global), `umbral_flash` (% mínimo para alertas flash).

Cada producto: `id`, `producto`, `marca`, `formato`, `tienda`, `precio_actual`, `precio_anterior`, `descuento_pct` (null = lo calcula la web y lo marca con «*, cálculo propio»), `enlace` (vacío = «No verificado»), `fecha_verificacion`, `disponibilidad`, `categoria`, `tipo` (`flash|comparador|kbeauty|moda|viral`), `grupo` (une el mismo producto entre tiendas), `motivo`, `ventaja`, `fecha_limite`, `precio_desde`, `ejemplo`, `mostrada_antes`, `historial` (`[{fecha, precio}]`).

## Actualización diaria

1. **Tiendas legibles** (Druni, Primor, Mango, Zara, Notino, Douglas): abre sus páginas de ofertas guardadas en `config.json`, o pídele a Claude que las lea y genere el JSON.
2. **Tiendas dinámicas o bloqueadas** (El Corte Inglés, H&M, Bershka, Perfumes Club, Stylevana, Amazon.es): pega la URL de la ficha y el precio en `admin.html`. Amazon se introduce siempre a mano.
3. En `admin.html`, guarda cada precio; si el producto ya existía, el precio anterior pasa solo al historial y se actualiza la fecha.
4. Descarga `productos.json` y sustituye el de `data/`. Súbelo al hosting (Netlify, GitHub Pages, Hostinger…).
5. Para no repetir ofertas de días anteriores, marca `"mostrada_antes": true`; solo reaparecerán en Flash si el precio ha bajado respecto al historial.

Regla de oro: solo se publican datos verificados ese día en la ficha, con su enlace. Sin enlace, la web los marca como «No verificado».

## Pendiente / decisiones tuyas

- Sustituir los datos de ejemplo (borra `"ejemplo": true` o ponlo en `false` en `meta`).
- Imágenes: solo se mostrarán las de la tienda enlazada (campo no incluido aún).
- Afiliados: pon `"afiliados": true` en `config.json` y la web mostrará el aviso y marcará los enlaces `sponsored`.

## Actualización diaria automática

Tarea programada «Actualizar ofertas de belleza» (cada día a las 9:05, con la app de Claude abierta; si está cerrada se ejecuta al abrirla). Lee las URLs de `config.json`, verifica cada ficha y reescribe `productos.json`. Notino y Douglas responden 403 y Mango 429: no se fuerza el acceso, esos datos se meten a mano en `admin.html`.

## Cómo se leen Druni y Primor (v0.3)

Con el navegador integrado de Claude (no con WebFetch, que daba falsos «Agotado»/«No está disponible»):
- **Druni:** cada ficha trae datos estructurados `application/ld+json` (precio, `InStock`, imagen). Las secciones útiles son `/ofertas-flash` y `/virales-tiktok` (de ahí sale el motivo viral verificado).
- **Primor:** el listado `/ofertas-flash` muestra «Añadir al carrito»; la ficha incluye `availability: InStock` y el precio de cada tamaño (`optionPrices`).
- Los precios «Tan bajo como» son el mínimo entre variantes: se publican con `precio_desde: true`.
