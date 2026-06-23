// ---------------------------------------------------------------------------
// Code.gs — menu, triggers, orquestacion
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ciber')
    .addItem('Sincronizar ahora', 'sincronizarAhora')
    .addItem('Abrir panel', 'abrirPanel')
    .addSeparator()
    .addItem('Instalar trigger diario', 'instalarTriggerDiario')
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
