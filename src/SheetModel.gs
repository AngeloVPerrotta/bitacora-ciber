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

// Descripciones canonicas — fuente de verdad: etapas-contenido.md (texto tal cual).
// No editar a mano en el Sheet: migrate() las reescribe desde aca.
var DESCRIPCIONES = {
  b0: "Preparación liviana antes de arrancar los labs (para no chocar con deadlines).\n- Responder la teoría base de Etapa 1 (dejarla anotada).\n- Armar el sistema de notas (ver Etapa 4).",
  e1: "**Responder (qué es cada cosa):**\n- ¿Qué es una dirección IP? ¿Rangos de IP?\n- IP privada e IP pública\n- Dominio, subdominios y DNS\n- Protocolo TCP y UDP\n- ¿Qué son los puertos de una computadora?\n- ¿Qué es un servicio? ¿A dónde se sirven a nivel de red?\n- ¿Qué es HTTP y HTTPS?\n- ¿Qué es un CVE?\n\n**Curso / práctica:**\n- PortSwigger Web Security Academy (Labs de SQLi, XSS, autenticación)\n- TryHackMe — Ruta \"Pre Security\" + \"Introduction to Cyber Security\"\n- Linux — Curso Udemy",
  e2: "**Kali Linux como herramienta de trabajo:** cómo se instala, familiarizarme, estructuras de archivos y directorios.\n\n**Responder:**\n- ¿Qué hacen estos comandos? ls, cd, cat, sudo, cp, mv, mkdir, chmod, touch, nano\n- ¿Qué es una bash?\n- ¿Qué es una reverse shell?\n- ¿Qué es un RCE?\n- ¿Qué es un Burp Suite?\n\n**OSINT:**\n- TryHackMe — Ruta \"OSINT\" (rooms: Sakura, OhSINT, Searchlight)\n- Herramientas: Sherlock, theHarvester, Shodan (cuenta gratis), Google dorks, Maltego CE\n- Bellingcat — Toolkit pública de OSINT",
  e3: "Construir metodología / pensamiento atacante. 15% teoría, 85% metodología.\nPracticar en HackTheBox. TJ Null y S4vitar. Rendir el OSCP. Mirar writeups. El que se frustra pierde.\n\n- TryHackMe ruta \"Jr Penetration Tester\" o HTB Academy módulos gratuitos.\n- Burp Suite Community + nmap + Wireshark en serio.\n- Acá ya podés intentar un CTF chico (PicoCTF está bueno para arrancar).",
  e4: "Es importante tener tus propios apuntes. Tomar notas en OneNote (formato de Tyler Ramsbey):\n- Abrir OneNote, poner título de la máquina que vaya a hacer e indicar si es de Windows o Linux.\n- Añadir subpáginas con cada puerto reportado en la máquina.\n- En la página principal, el escaneo de nmap; después, lo que vaya haciendo en cada puerto en su subpágina.\n- Después, evaluar Obsidian.",
  e5: "Rubros y sectores."
};

var ETAPAS_HEADERS = [
  'id', 'nombre', 'horas_estimadas', 'horas_semana',
  'estado', 'progreso', 'fecha_fin_real', 'event_id', 'descripcion'
];

// 'descripcion' va al final (no antes de 'estado'): Code.gs onEdit depende de
// que 'estado' siga en la columna 5. e4 es PARALELA → horas_semana = 0.
var SEED_ETAPAS = [
  ['b0', 'Bloque 0 — Arranque',            4.5,  1.5, 'en_curso',  0, '', '', DESCRIPCIONES.b0],
  ['e1', 'Etapa 1 — Bases',                45,   3,   'pendiente', 0, '', '', DESCRIPCIONES.e1],
  ['e2', 'Etapa 2 — Kali + OSINT',         27,   3,   'pendiente', 0, '', '', DESCRIPCIONES.e2],
  ['e3', 'Etapa 3 — Metodologia ofensiva', 150,  3,   'pendiente', 0, '', '', DESCRIPCIONES.e3],
  ['e4', 'Etapa 4 — Notetaking',           0,    0,   'pendiente', 0, '', '', DESCRIPCIONES.e4],
  ['e5', 'Etapa 5 — Rubros/sectores',      6,    3,   'pendiente', 0, '', '', DESCRIPCIONES.e5]
];

var TASKS_HEADERS = ['etapa_id', 'tarea', 'hecho'];

// Renombrados que migrate() aplica sobre el Sheet existente (solo la columna
// 'tarea'; preserva el tilde 'hecho' de cada fila).
var TASK_RENAMES = [
  { from: 'THM: Linux Fundamentals 1-2-3',         to: 'Linux — Curso Udemy' },
  { from: 'Definir rubro/sector y mapear mercado', to: 'Rubros y sectores' }
];

// Tareas de la Etapa 4 (paralela). Se insertan entre e3 y e5.
var SEED_TASKS_E4 = [
  ['e4', 'Armar sistema de notas en OneNote (formato Tyler Ramsbey): título de máquina, Win/Linux, subpáginas por puerto, nmap en la principal', false],
  ['e4', 'Evaluar Obsidian',                                                    false]
];

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
  ['e1', 'Linux — Curso Udemy',                                                 false],
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
  ['e3', 'Contenido de S4vitar',                                                false]
].concat(SEED_TASKS_E4).concat([
  ['e5', 'Rubros y sectores',                                                   false]
]);

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

  formatSheets();
}

// ======================== MIGRATION ========================================
// Migra un Sheet YA EXISTENTE a la estructura nueva sin borrar el progreso:
//   Etapas → agrega la columna 'descripcion', inserta la fila e4 (paralela)
//            entre e3 y e5, y reescribe las descripciones canonicas.
//   Tasks  → renombra tareas (preservando el tilde 'hecho') y agrega las de e4.
// Idempotente: correrla varias veces no duplica filas ni pisa tildes.
// Correr desde el editor de Apps Script (Run > migrate).

function migrate() {
  ensureSheets();        // crea hojas si faltaran (no recrea las existentes)
  migrarEtapas_();
  migrarTasks_();
  formatSheets();        // casillas nuevas como checkboxes + formato general
}

function migrarEtapas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ETAPAS);
  if (!sheet || sheet.getLastRow() < 2) return;

  // 1. asegurar columna 'descripcion' (al final: 'estado' debe seguir en col 5
  //    porque Code.gs onEdit depende de esa posicion)
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('descripcion') === -1) {
    var newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue('descripcion');
    headers.push('descripcion');
  }
  var colId = headers.indexOf('id') + 1;
  var colDesc = headers.indexOf('descripcion') + 1;

  // 2. insertar la fila e4 entre e3 y e5 si todavia no existe
  var ids = sheet.getRange(2, colId, sheet.getLastRow() - 1, 1)
    .getValues().map(function(r) { return r[0]; });
  if (ids.indexOf('e4') === -1) {
    var idxE5 = ids.indexOf('e5');
    var e4Row;
    if (idxE5 !== -1) {
      e4Row = idxE5 + 2;              // +2: fila 1 = header, indice 0-based
      sheet.insertRowsBefore(e4Row, 1);
    } else {
      e4Row = sheet.getLastRow() + 1; // sin e5: la agregamos al final
    }
    var e4 = {
      id: 'e4', nombre: 'Etapa 4 — Notetaking',
      horas_estimadas: 0, horas_semana: 0,   // paralela: no consume cronograma
      estado: 'pendiente', progreso: 0,
      fecha_fin_real: '', event_id: '',
      descripcion: DESCRIPCIONES.e4
    };
    for (var f in e4) {
      var c = headers.indexOf(f);
      if (c !== -1) sheet.getRange(e4Row, c + 1).setValue(e4[f]);
    }
  }

  // 3. reescribir las descripciones canonicas para cada etapa conocida
  //    (no toca estado/progreso/horas/event_id)
  var lastRow = sheet.getLastRow();
  var rowIds = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
  for (var i = 0; i < rowIds.length; i++) {
    var id = rowIds[i][0];
    if (DESCRIPCIONES.hasOwnProperty(id)) {
      sheet.getRange(i + 2, colDesc).setValue(DESCRIPCIONES[id]);
    }
  }
}

function migrarTasks_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet || sheet.getLastRow() < 2) return;

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // etapa_id, tarea

  // 1. renombrar tareas (solo la columna 'tarea', preserva el tilde 'hecho')
  for (var i = 0; i < data.length; i++) {
    for (var r = 0; r < TASK_RENAMES.length; r++) {
      if (data[i][1] === TASK_RENAMES[r].from) {
        sheet.getRange(i + 2, 2).setValue(TASK_RENAMES[r].to);
      }
    }
  }

  // 2. agregar las tareas de e4 si faltan (tras el ultimo task de e3, para que
  //    el orden quede b0, e1, e2, e3, e4, e5)
  var tieneE4 = false, lastE3 = -1;
  for (var j = 0; j < data.length; j++) {
    if (data[j][0] === 'e4') tieneE4 = true;
    if (data[j][0] === 'e3') lastE3 = j;
  }
  if (!tieneE4) {
    var insertAfter = (lastE3 !== -1) ? (lastE3 + 2) : sheet.getLastRow();
    sheet.insertRowsAfter(insertAfter, SEED_TASKS_E4.length);
    sheet.getRange(insertAfter + 1, 1, SEED_TASKS_E4.length, 3)
      .setValues(SEED_TASKS_E4);
  }
}

// ======================== FORMAT SHEETS ====================================

function formatSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Tasks ---
  var tasks = ss.getSheetByName(SHEET_TASKS);
  if (tasks) {
    var lastRowT = tasks.getLastRow();
    // header: bold + frozen
    tasks.getRange(1, 1, 1, 3).setFontWeight('bold');
    tasks.setFrozenRows(1);

    if (lastRowT > 1) {
      // checkboxes en columna "hecho" (col 3) para todas las filas de datos
      tasks.getRange(2, 3, lastRowT - 1, 1).insertCheckboxes();
    }

    tasks.autoResizeColumns(1, 3);

    // banding: limpiar bandings previos, poner uno nuevo
    var bandings = tasks.getBandings();
    for (var b = 0; b < bandings.length; b++) bandings[b].remove();
    if (lastRowT > 1) {
      tasks.getRange(1, 1, lastRowT, 3)
        .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    }
  }

  // --- Etapas ---
  var etapas = ss.getSheetByName(SHEET_ETAPAS);
  if (etapas) {
    var headers = etapas.getRange(1, 1, 1, etapas.getLastColumn()).getValues()[0];
    var lastRowE = etapas.getLastRow();

    // header: bold + frozen
    etapas.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    etapas.setFrozenRows(1);

    if (lastRowE > 1) {
      // dropdown en "estado"
      var colEstado = headers.indexOf('estado') + 1;
      if (colEstado > 0) {
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(['pendiente', 'en_curso', 'hecho'], true)
          .setAllowInvalid(false)
          .build();
        etapas.getRange(2, colEstado, lastRowE - 1, 1).setDataValidation(rule);
      }

      // "progreso" como porcentaje
      var colProgreso = headers.indexOf('progreso') + 1;
      if (colProgreso > 0) {
        etapas.getRange(2, colProgreso, lastRowE - 1, 1).setNumberFormat('0%');
      }

      // "fecha_fin_real" como fecha
      var colFecha = headers.indexOf('fecha_fin_real') + 1;
      if (colFecha > 0) {
        etapas.getRange(2, colFecha, lastRowE - 1, 1).setNumberFormat('yyyy-mm-dd');
      }
    }

    // ocultar columna "event_id"
    var colEventId = headers.indexOf('event_id') + 1;
    if (colEventId > 0) {
      etapas.hideColumns(colEventId);
    }

    etapas.autoResizeColumns(1, headers.length);

    // "descripcion": ancho fijo + wrap (autoResize la dejaria gigante)
    var colDesc = headers.indexOf('descripcion') + 1;
    if (colDesc > 0) {
      etapas.setColumnWidth(colDesc, 460);
      if (lastRowE > 1) {
        etapas.getRange(2, colDesc, lastRowE - 1, 1)
          .setWrap(true)
          .setVerticalAlignment('top');
      }
    }
  }

  // --- _sync: oculta ---
  var sync = ss.getSheetByName(SHEET_SYNC);
  if (sync && !sync.isSheetHidden()) {
    sync.hideSheet();
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

// Escribe el tilde 'hecho' (col 3) de una tarea por numero de fila. `row` es el
// _row que getTasks() expone (y que la API devuelve como id de tarea). Si se
// pasa etapaIdEsperado, valida que la fila pertenezca a esa etapa antes de
// escribir (chequeo de seguridad contra ids desfasados). Devuelve true si escribio.
function setTaskHecho_(row, value, etapaIdEsperado) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  if (row < 2 || row > lastRow) return false; // fila 1 = header

  if (etapaIdEsperado) {
    var rowEtapa = sheet.getRange(row, 1).getValue();
    if (rowEtapa !== etapaIdEsperado) return false;
  }

  sheet.getRange(row, 3).setValue(value === true);
  return true;
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
