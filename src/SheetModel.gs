// ---------------------------------------------------------------------------
// SheetModel.gs — lectura/escritura del Google Sheet (fuente de verdad)
// ---------------------------------------------------------------------------

var SHEET_SETTINGS = 'Settings';
var SHEET_ETAPAS   = 'Etapas';
var SHEET_TASKS    = 'Tasks';
var SHEET_SYNC     = '_sync';

// ======================== SEED DATA ========================================

var SEED_SETTINGS = [
  ['clave',          'valor'],
  ['fecha_inicio',   '2026-07-07'],
  ['dias_sesion',    'TU,TH'],
  ['horario',        '13:00-14:30'],
  ['zona_horaria',   'America/Argentina/Buenos_Aires']
];

var ETAPAS_HEADERS = [
  'id', 'nombre', 'horas_estimadas', 'horas_semana',
  'estado', 'progreso', 'fecha_fin_real', 'event_id'
];

var SEED_ETAPAS = [
  ['b0', 'Bloque 0 — Arranque',            4.5,  1.5, 'en_curso',  0, '', ''],
  ['e1', 'Etapa 1 — Bases',                45,   3,   'pendiente', 0, '', ''],
  ['e2', 'Etapa 2 — Kali + OSINT',         27,   3,   'pendiente', 0, '', ''],
  ['e3', 'Etapa 3 — Metodologia ofensiva', 150,  3,   'pendiente', 0, '', ''],
  ['e5', 'Etapa 5 — Rubros/sectores',      6,    3,   'pendiente', 0, '', '']
];

var TASKS_HEADERS = ['etapa_id', 'tarea', 'hecho'];

var SEED_TASKS = [
  ['b0', 'Responder teoria base de Etapa 1 (lectura)',                          false],
  ['b0', 'Armar vault de Obsidian + plantilla de maquina (formato Tyler Ramsbey)', false],
  ['e1', 'Teoria: IP y rangos',                                                 false],
  ['e1', 'Teoria: IP privada vs publica',                                       false],
  ['e1', 'Teoria: dominio/subdominio/DNS',                                      false],
  ['e1', 'Teoria: TCP vs UDP',                                                  false],
  ['e1', 'Teoria: puertos',                                                     false],
  ['e1', 'Teoria: que es un servicio y donde se sirve',                          false],
  ['e1', 'Teoria: HTTP vs HTTPS',                                               false],
  ['e1', 'Teoria: que es un CVE',                                               false],
  ['e1', 'PortSwigger: labs SQLi',                                              false],
  ['e1', 'PortSwigger: labs XSS',                                               false],
  ['e1', 'PortSwigger: labs autenticacion',                                     false],
  ['e1', 'TryHackMe: ruta Pre Security',                                        false],
  ['e1', 'TryHackMe: Introduction to Cyber Security',                           false],
  ['e1', 'THM: Linux Fundamentals 1-2-3',                                       false],
  ['e2', 'Instalar Kali en VM + estructura de archivos',                        false],
  ['e2', 'Teoria: comandos ls/cd/cat/sudo/cp/mv/mkdir/chmod/touch/nano',        false],
  ['e2', 'Teoria: bash / reverse shell / RCE / Burp Suite',                     false],
  ['e2', 'THM OSINT: Sakura, OhSINT, Searchlight',                             false],
  ['e2', 'Herramientas: Sherlock, theHarvester, Shodan, dorks, Maltego CE',     false],
  ['e2', 'Toolkit de Bellingcat',                                               false],
  ['e3', 'THM: ruta Jr Penetration Tester',                                     false],
  ['e3', 'HTB Academy: modulos gratis',                                         false],
  ['e3', 'Burp + nmap + Wireshark en serio',                                    false],
  ['e3', 'PicoCTF (primer CTF)',                                                false],
  ['e3', 'HackTheBox: lista de TJ Null (varias maquinas)',                      false],
  ['e3', 'Contenido de S4vitar',                                                false],
  ['e5', 'Definir rubro/sector y mapear mercado',                               false]
];

// ======================== ENSURE SHEETS ====================================

function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(SHEET_SETTINGS)) {
    var s = ss.insertSheet(SHEET_SETTINGS);
    s.getRange(1, 1, SEED_SETTINGS.length, 2).setValues(SEED_SETTINGS);
    s.getRange(1, 1, 1, 2).setFontWeight('bold');
    s.autoResizeColumns(1, 2);
  }

  if (!ss.getSheetByName(SHEET_ETAPAS)) {
    var e = ss.insertSheet(SHEET_ETAPAS);
    var all = [ETAPAS_HEADERS].concat(SEED_ETAPAS);
    e.getRange(1, 1, all.length, ETAPAS_HEADERS.length).setValues(all);
    e.getRange(1, 1, 1, ETAPAS_HEADERS.length).setFontWeight('bold');
    e.autoResizeColumns(1, ETAPAS_HEADERS.length);
  }

  if (!ss.getSheetByName(SHEET_TASKS)) {
    var t = ss.insertSheet(SHEET_TASKS);
    var allT = [TASKS_HEADERS].concat(SEED_TASKS);
    t.getRange(1, 1, allT.length, TASKS_HEADERS.length).setValues(allT);
    t.getRange(1, 1, 1, TASKS_HEADERS.length).setFontWeight('bold');
    // columna "hecho" como checkboxes
    t.getRange(2, 3, SEED_TASKS.length, 1).insertCheckboxes();
    t.autoResizeColumns(1, TASKS_HEADERS.length);
  }

  if (!ss.getSheetByName(SHEET_SYNC)) {
    var sy = ss.insertSheet(SHEET_SYNC);
    sy.getRange(1, 1, 1, 2).setValues([['clave', 'valor']]);
    sy.getRange(1, 1, 1, 2).setFontWeight('bold');
    sy.getRange(2, 1, 1, 2).setValues([['ultima_sync', '']]);
    sy.hideSheet();
  }
}

// ======================== READERS ==========================================

function getSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function getEtapas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ETAPAS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var etapas = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    obj._row = i + 1; // 1-indexed row in sheet
    etapas.push(obj);
  }
  return etapas;
}

function getTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var tasks = [];
  for (var i = 1; i < data.length; i++) {
    tasks.push({
      etapa_id: data[i][0],
      tarea:    data[i][1],
      hecho:    data[i][2] === true,
      _row:     i + 1
    });
  }
  return tasks;
}

function getTasksByEtapa(etapaId) {
  return getTasks().filter(function(t) { return t.etapa_id === etapaId; });
}

// ======================== WRITERS ==========================================

function updateEtapaField_(etapaId, field, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ETAPAS);
  if (!sheet) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = headers.indexOf(field);
  if (col === -1) return;

  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === etapaId) {
      sheet.getRange(i + 2, col + 1).setValue(value);
      return;
    }
  }
}

function updateEtapaProgress(etapaId, progress) {
  updateEtapaField_(etapaId, 'progreso', progress);
}

function updateEtapaEstado(etapaId, estado) {
  updateEtapaField_(etapaId, 'estado', estado);
}

function updateEtapaFechaFinReal(etapaId, fecha) {
  updateEtapaField_(etapaId, 'fecha_fin_real', fecha);
}

function updateEtapaEventId(etapaId, eventId) {
  updateEtapaField_(etapaId, 'event_id', eventId);
}

// ======================== RECALC PROGRESS ==================================

function recalcProgress() {
  var tasks = getTasks();
  var etapas = getEtapas();
  var today = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');

  etapas.forEach(function(etapa) {
    var etapaTasks = tasks.filter(function(t) { return t.etapa_id === etapa.id; });
    if (etapaTasks.length === 0) return;

    var done = etapaTasks.filter(function(t) { return t.hecho; }).length;
    var progress = done / etapaTasks.length;

    updateEtapaProgress(etapa.id, progress);

    // auto-complete: si progreso = 100% y no estaba hecho
    if (progress >= 1 && etapa.estado !== 'hecho') {
      updateEtapaEstado(etapa.id, 'hecho');
      updateEtapaFechaFinReal(etapa.id, today);
    }

    // auto-start: si hay algo hecho y todavia estaba pendiente
    if (progress > 0 && progress < 1 && etapa.estado === 'pendiente') {
      updateEtapaEstado(etapa.id, 'en_curso');
    }
  });
}

// ======================== SYNC LOG =========================================

function setSyncTimestamp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SYNC);
  if (!sheet) return;
  var now = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm:ss');
  sheet.getRange(2, 2).setValue(now);
}

function getSyncTimestamp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SYNC);
  if (!sheet) return null;
  return sheet.getRange(2, 2).getValue();
}

// ======================== DATA FOR SIDEBAR =================================

function getDashboardData() {
  var settings = getSettings();
  var etapas = getEtapas();
  var tasks = getTasks();
  var proyeccion = proyectar();

  return {
    settings: settings,
    etapas: proyeccion,
    tasks: tasks,
    ultimaSync: getSyncTimestamp()
  };
}
