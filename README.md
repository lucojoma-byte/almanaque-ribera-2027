# Almanaque Ribera 2027

Almanaque personal de Joe para Zapopan y la Ribera de Chapala. La etapa 2 incluye **Hoy**, **Calendario** y **Siembra**, el conversor de las cuatro hojas y la PWA offline. [Abrir la aplicación publicada](https://lucojoma-byte.github.io/almanaque-ribera-2027/). La interfaz usa HTML, CSS y JavaScript locales. Para probarla desde la raíz del repositorio, ejecuta `python -m http.server 8000 --directory public` y abre <http://localhost:8000>. En Windows puedes usar `py` en lugar de `python`.

## Actualizar y publicar en tres pasos

1. **Actualizar el Excel.** Edita o reemplaza `data/Almanaque_Ribera_2027_BASE.xlsx`. La copia de esta entrega proviene del libro de Drive `Almanaque_Ribera_2027_BASE_ChatGPT.xlsx`. Mantén los nombres de las hojas, tablas y columnas. Para agregar registros a una tabla de Excel, amplía la tabla. Conserva el encabezado de labores mensuales y sus filas contiguas en SIEMBRA.
2. **Correr el script.** Con Python 3.10 o posterior, instala la dependencia una vez con `python -m pip install -r requirements.txt`. Después de cada cambio, ejecuta `python scripts/build_data.py`. El script genera cuatro archivos en `public/data/` y actualiza `public/sw.js` según el contenido de la edición. Ejecútalo también si modificas la interfaz.
3. **Publicar.** En el repositorio de GitHub, selecciona **Settings → Pages → Source → GitHub Actions**. Sube a la rama `main` los cambios, incluidos los JSON, los recursos de `public/` y el flujo de `.github/workflows/`. El flujo despliega `public/`. El enlace publicado aparece en la ejecución de **Publicar el almanaque** y en **Settings → Pages**. La edición pública incluye CIELO, SIEMBRA y FECHAS Y CLIMA. El Excel original y el JSON de NEGOCIO Y VIDA se conservan en la copia local. Si clonas el repositorio, crea la carpeta data y coloca allí tu libro base antes de ejecutar el conversor.

## Lectura de la edición

La ficha abre con el día civil de Jalisco. Antes de 2027 muestra el 1 de enero como vista previa. Después de 2027 abre el 31 de diciembre. El selector permite recorrer toda la edición. La agenda de siete días incluye la fecha elegida y los seis días siguientes disponibles en 2027.

Las horas solares, la iluminación y las fases provienen de CIELO. La base registra únicamente las fases principales. Los indicadores reproducen el estado de la fila. Las notas de la hoja conservan las limitaciones sobre la hora de muestreo de la iluminación, el relieve y la visibilidad. La temporada de Chapala es histórica. Las tareas mensuales del huerto conservan el estado de SIEMBRA.

El conversor preserva textos, valores vacíos, estados y notas del libro. Serializa fechas y horas en formato ISO. Un porcentaje de Excel permanece como fracción en JSON y se presenta como porcentaje en la pantalla. Las fórmulas requieren un valor calculado guardado desde Excel.

Para instalar la PWA, abre el sitio publicado en el navegador y usa **Instalar aplicación** o **Agregar a inicio**. Cuando aparezca **Disponible sin conexión**, podrás volver a abrir la edición sin red. Después de publicar una actualización, visita la app con conexión y cierra las ventanas anteriores para activar la nueva copia.


En **Calendario**, toca un día para abrir su ficha solar, lunar, civil y escolar. En **Siembra**, el filtro de mes incluye siembra directa, almácigo y trasplante. Cada ficha conserva los meses, las condiciones y la fuente que figuran en Excel. El botón **¿Qué siembro este mes?** usa el mes actual de Jalisco y restablece los demás filtros.
