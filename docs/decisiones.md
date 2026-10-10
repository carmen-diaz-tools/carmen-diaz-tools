# Decisiones

## App web en GitHub Pages, sin build ni dependencias
Se instala desde el navegador ("Añadir a inicio") en Android e iOS. No hay que publicar en ninguna tienda de apps ni mantener un servidor. Al no tener dependencias, no se rompe con el tiempo. Un service worker la deja funcionar sin conexión.

## Sin base de datos en la primera versión
El catálogo vive en Shopify. Lo único que se guarda (último tipo y marca usados, tipos y marcas añadidos desde la app) va en `localStorage`, a través de `app/js/storage.js`. Si más adelante hace falta compartir datos entre dispositivos (historial de etiquetas, control de duplicados), se conectará Supabase en ese archivo, con login real y RLS para que los datos no sean públicos.

## PIN
El código está en un repositorio público, así que el PIN (guardado como hash) solo evita que alguien entre por casualidad. No protege datos, y ahora mismo no hay ninguno que proteger.

## Código de barras
- Si el producto trae **EAN** del fabricante, se imprime ese EAN, que es lo que ya tiene Shopify en "Código de barras".
- Si no lo trae, se imprime el **SKU**, que hay que poner también en "Código de barras" en Shopify, porque el POS busca por ese campo.
- Se usa Code 128 en los dos casos. Los tramos numéricos van en el juego C, así que un EAN ocupa poco y sus barras salen gruesas.

## Tamaño de la imagen: 696 × 271 px
Es el área de impresión de la DK-11209 (62 × 29 mm) a 300 ppp, según la tabla de etiquetas de `brother_ql`. El rollo continuo de 62 mm tiene el mismo ancho, así que la oferta usa el mismo tamaño. Las barras usan anchos de píxel enteros: si la imagen se imprime al 100 %, salen nítidas.

## Formato del SKU
`TIPO(3)-MARCA(3)-MODELO(6)-TALLA(3)-COLOR(6)`. Las longitudes son distintas a las del formato antiguo, así que un SKU nuevo no puede chocar con uno existente.

## Pendiente
- Confirmar con la impresora cómo trata iPrint&Label la imagen compartida: escala y rojo en DK-22251.
- Confirmar la lectura con cámara de un SKU de 25 caracteres. Si falla, valorar un código de barras más corto, lo que obligaría a cambiar lo que se pone en Shopify.
