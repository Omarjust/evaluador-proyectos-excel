# Evaluador de Proyectos (complemento de Excel)

Panel lateral para Excel (Mac, Windows y web) que arma la evaluación financiera completa con el formato de clase de Evaluación de Proyectos:

- **Hojas con fórmulas vivas:** Ventas por producto (hasta 10), Depreciación, Préstamo (amortización constante y cuota fija, con gracia y tasa nominal mensual), Flujo puro y financiado, VAC y CAE (con comparador de alternativas).
- **Indicadores:** VAN, TIR, TUR, B/C, TRI y precio mínimo, con la recomendación automática de **TIR o TUR** y su porqué.
- **Riesgo:** tornado, **análisis de araña**, puntos críticos, escenarios y **Monte Carlo** (triangular, PERT, uniforme o normal, con semilla).
- **Preguntas de riesgo interactivas**, por ejemplo: "¿riesgo de que no sea factible?", "¿riesgo de que la rentabilidad sea menor a 18 %?", "¿probabilidad de que el VAN esté entre X e Y?". Cada respuesta trae el número, un gráfico y el porqué. En la hoja Riesgo quedan como fórmulas: cambias X o Y y la probabilidad se recalcula.
- **Diagnóstico:** alertas, punto de equilibrio y el plan del flujo explicado año por año.

Solo escribes tus datos en las celdas amarillas de la hoja **Datos**. Todo lo demás se calcula.

## Instalar

### Excel para Mac

1. Descarga [`manifest.xml`](https://omarjust.github.io/evaluador-proyectos-excel/manifest.xml).
2. Cópialo en esta carpeta (créala si no existe):

   ```
   ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
   ```

3. Cierra y vuelve a abrir Excel. En **Inicio** aparece el botón **Evaluador**. Si no aparece, ve a **Insertar → Complementos → Mis complementos** y búscalo en la sección del desarrollador.

### Excel en la web (Microsoft 365)

1. Abre un libro y ve a **Insertar → Complementos → Más complementos** (u **Office Add-ins**).
2. Elige **Cargar mi complemento** y sube `manifest.xml`.

### Excel para Windows

Comparte una carpeta de red con el `manifest.xml`, agrégala en **Archivo → Opciones → Centro de confianza → Catálogos de complementos de confianza** y luego **Insertar → Mis complementos → Carpeta compartida**.

## Usar

1. **Inicio:** pulsa **Cargar ejemplo** (Casos 4, 5 y 6 del curso o un ejemplo con 3 productos), **Plantilla vacía** o **Leer mi hoja**. Si el libro tiene la plantilla de clase ("Vida útil del proyecto" en A18), Leer mi hoja la importa sola.
2. **Datos:** completa lo que falte. Lo que cambies en el panel se escribe en la hoja Datos. Las series por año y los activos se editan directamente en la hoja.
3. **Generar análisis:** crea todas las hojas, corre el Monte Carlo y comprueba que el VAN de la hoja sea igual al del panel.
4. **Resultados, Riesgo y Diagnóstico:** cada número tiene su botón **¿Por qué?**.

## Cómo se verificó

- `npm test`: el motor reproduce al centavo los resultados de `Plantilla Flujo de Caja VAC CAE.xlsx` (Casos 5 y 6, los tres flujos con VAN, TIR, TUR, B/C, TRI, precio mínimo, VAC y CAE) y del Caso 4 del Segundo Parcial (VAN 263.755,44 puro y 287.483,90 financiado).
- `sh tools/verificar.sh ejemplos/caso5.json /tmp`: arma el libro con las mismas fórmulas, lo recalcula con LibreOffice y compara celda por celda con el motor (0 diferencias y 0 errores en los cuatro ejemplos).

## Desarrollo

```
npm install
npm run dev        # panel en http://localhost:3000 (sin Excel funciona en modo demostración: ?ejemplo=caso5)
npm test           # pruebas del motor, preguntas, diagnóstico y lectura de datos
npm run build      # dist/ + manifest.xml
```

Para probar en Excel con el servidor local hace falta HTTPS (`npx office-addin-dev-certs install`) y cargar `manifest.local.xml`.

Estructura: `src/motor` (cálculo puro), `src/excel` (hojas como lista de operaciones y su ejecución con Office.js), `src/ui` y `src/main.js` (panel).
