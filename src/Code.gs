// ---------------------------------------------------------------------------
// Code.gs — menu, triggers, orquestacion
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ciber')
    .addItem('Sincronizar ahora', 'sincronizarAhora')
    .addItem('Resync limpio', 'sincronizarAhora')
    .addItem('Abrir panel', 'abrirPanel')
    .addSeparator()
    .addItem('Instalar trigger diario', 'instalarTriggerDiario')
    .addItem('Aplicar formato', 'formatSheets')
    .addItem('Borrar todas las bandas', 'borrarTodasLasBandas')
    .addToUi();
}

function sincronizarAhora() {
  ensureSheets();
  recalcProgress();
  syncCalendar();
  SpreadsheetApp.getActiveSpreadsheet().toast('Sync completo.', 'Ciber', 3);
}

function abrirPanel() {
  var html = HtmlService
    .createHtmlOutputFromFile('Sidebar')
    .setTitle('ciber://status');
  SpreadsheetApp.getUi().showSidebar(html);
}

// ======================== TRIGGERS =========================================

function instalarTriggerDiario() {
  // evitar duplicados
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'triggerDiario') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('triggerDiario')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Trigger diario instalado (8 AM).', 'Ciber', 3
  );
}

function triggerDiario() {
  ensureSheets();
  recalcProgress();
  syncCalendar();
}

// ======================== ON EDIT ==========================================

function onEditHandler(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name = sheet.getName();

  // reaccionar solo a cambios en Tasks.hecho o Etapas.estado
  if (name === 'Tasks' && e.range.getColumn() === 3) {
    recalcProgress();
    syncCalendar();
  } else if (name === 'Etapas' && e.range.getColumn() === 5) {
    syncCalendar();
  }
}

function instalarOnEdit() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditHandler') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('onEditHandler')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

// ======================== WEB API (JSONP) ==================================
// El front vive aparte (Hostinger). Apps Script no manda cabeceras CORS, asi
// que la API se consume por JSONP: <script src=".../exec?action=...&callback=fn">
// y la respuesta es siempre `fn(<json>);`. Si no viene callback se devuelve
// JSON plano (util para probar a mano).
//
// Endpoints (GET):
//   ?action=state                           -> estado completo
//   ?action=toggle&taskId=<row>&value=<b>   -> tilda/destilda, resync, estado
// (Opcional &etapaId=<id> en toggle como chequeo de seguridad de la fila.)
//
// OJO: doGet sirve la VERSION DESPLEGADA. Tras `clasp push` hay que crear una
// version nueva de la implementacion (Implementar > Gestionar implementaciones)
// para que /exec tome los cambios.

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = (p.action || 'state').toLowerCase();
  var out;

  try {
    if (action === 'state') {
      out = buildState_();
    } else if (action === 'toggle') {
      out = apiToggle_(p);
    } else {
      out = { error: 'accion desconocida: ' + action };
    }
    out.ok = (out.error === undefined);
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }

  return jsonpOut_(out, p.callback);
}

// Devuelve la respuesta como JSONP (callback(json);) con MimeType.JAVASCRIPT.
// Si no hay callback valido, JSON plano con MimeType.JSON.
function jsonpOut_(obj, callback) {
  var json = JSON.stringify(obj);
  var cb = safeCallback_(callback);
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// Solo aceptamos nombres de callback que sean identificadores JS (admite
// notacion punto, ej. window.cb). Evita inyectar codigo arbitrario en la pagina.
function safeCallback_(cb) {
  if (!cb) return null;
  return /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(cb) ? cb : null;
}

function parseBool_(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'si';
}

// action=toggle: escribe `hecho` en Tasks, recalcula progreso, corre el sync y
// devuelve el estado actualizado (mismo shape que action=state).
function apiToggle_(p) {
  var taskId = parseInt(p.taskId, 10);
  if (!taskId) throw new Error('toggle: falta taskId valido');
  var value = parseBool_(p.value);

  var ok = setTaskHecho_(taskId, value, p.etapaId || null);
  if (!ok) throw new Error('toggle: no se encontro la tarea (row ' + p.taskId + ')');

  recalcProgress();
  syncCalendar();

  return buildState_();
}

// Estado completo que consume el front: etapas (con descripcion, estado,
// progreso, fechas proyectadas y sus tareas), etapa activa y fecha de llegada.
function buildState_() {
  var settings = getSettings();
  var tz = settings.zona_horaria || 'America/Argentina/Buenos_Aires';

  var proy = proyectar();        // proyeccion: id, nombre, estado, progreso, fechas...
  var etapasRaw = getEtapas();   // de aca sale 'descripcion' (proyeccion no la trae)
  var tasks = getTasks();

  var descById = {};
  etapasRaw.forEach(function(et) { descById[et.id] = et.descripcion || ''; });

  // tareas agrupadas por etapa; el `id` (= numero de fila) es lo que el front
  // manda de vuelta como taskId en el toggle.
  var tareasByEtapa = {};
  tasks.forEach(function(t) {
    (tareasByEtapa[t.etapa_id] = tareasByEtapa[t.etapa_id] || []).push({
      id:    t._row,
      texto: t.tarea,
      hecho: t.hecho
    });
  });

  var activaId = null;
  var llegada = null;

  var etapas = proy.map(function(e) {
    if (!activaId && e.estado !== 'hecho') activaId = e.id;
    // fecha de llegada = el fin proyectado mas lejano (las paralelas no cuentan)
    if (!e.paralela && e.fin_proyectado &&
        (!llegada || e.fin_proyectado.getTime() > llegada.getTime())) {
      llegada = e.fin_proyectado;
    }
    return {
      id:                 e.id,
      nombre:             e.nombre,
      descripcion:        descById[e.id] || '',
      estado:             e.estado,
      progreso:           e.progreso || 0,
      paralela:           !!e.paralela,
      inicio_proyectado:  fmtFecha_(e.inicio_proyectado, tz),
      fin_proyectado:     fmtFecha_(e.fin_proyectado, tz),
      sesiones_semana:    e.sesiones_semana || 0,
      semanas_necesarias: e.semanas_necesarias || 0,
      tareas:             tareasByEtapa[e.id] || []
    };
  });

  etapas.forEach(function(e) { e.activa = (e.id === activaId); });

  var ts = getSyncTimestamp();
  var ultimaSync = ts instanceof Date
    ? Utilities.formatDate(ts, tz, 'yyyy-MM-dd HH:mm:ss')
    : (ts ? String(ts) : null);

  return {
    etapas:        etapas,
    etapa_activa:  activaId,
    fecha_llegada: fmtFecha_(llegada, tz),
    ultima_sync:   ultimaSync
  };
}

function fmtFecha_(d, tz) {
  if (!d) return null;
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}
