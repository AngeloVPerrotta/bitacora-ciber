# bitacora-ciber

Sistema personal de tracking para mi ruta de aprendizaje en ciberseguridad (objetivo: OSCP).

Un Google Sheet es la fuente de verdad. Un Apps Script bound recalcula la proyeccion de fechas segun mi avance y sincroniza bandas en Google Calendar. El desarrollo es local con `clasp`.

## Setup (una sola vez)

### 1. Crear el Sheet y el script bound

1. Ir a [Google Sheets](https://sheets.google.com) y crear un spreadsheet nuevo (nombralo como quieras, ej. "Bitacora Ciber").
2. En el Sheet: **Extensiones > Apps Script**. Se abre el editor del script bound.
3. Copiar el **Script ID** de la URL del editor (`https://script.google.com/home/projects/SCRIPT_ID/edit`).

### 2. Instalar clasp y autenticar

```bash
npm i -g @google/clasp
clasp login
```

Esto abre el navegador para autenticarte con tu cuenta de Google.

### 3. Habilitar la Apps Script API

Ir a https://script.google.com/home/usersettings y activar **Google Apps Script API**.

### 4. Configurar el repo local

Editar `.clasp.json` y reemplazar `TU_SCRIPT_ID_ACA` con el Script ID real:

```json
{
  "scriptId": "tu-script-id-real",
  "rootDir": "src"
}
```

### 5. Subir el codigo al script

```bash
clasp push
```

La primera vez va a pedir que autorices los scopes (Sheets + Calendar + UI). Aceptar.

### 6. Inicializar las hojas

En el Sheet, recargar la pagina. Va a aparecer el menu **Ciber**. Click en **Ciber > Sincronizar ahora** para crear las hojas con la data seed y correr la primera sincronizacion.

### 7. (Opcional) Instalar el trigger diario

En el menu: **Ciber > Instalar trigger diario**. Esto crea un trigger time-driven que recalcula la proyeccion una vez por dia.

## Desarrollo

```bash
clasp push          # sube cambios al script
clasp pull          # baja cambios del editor online
clasp open          # abre el editor en el browser
```

## Estructura

```
src/
  appsscript.json   # manifest con scopes (Calendar, Sheets, UI)
  Code.gs           # onOpen, menu, triggers, orquestacion
  SheetModel.gs     # lectura/escritura del Sheet (etapas, tasks, settings)
  Scheduler.gs      # algoritmo de proyeccion de fechas
  CalendarSync.gs   # bandas idempotentes en Google Calendar
  Sidebar.html      # dashboard estilo terminal (HtmlService)
```
