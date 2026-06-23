// ---------------------------------------------------------------------------
// CalendarSync.gs — bandas idempotentes en Google Calendar
// ---------------------------------------------------------------------------
// Por cada etapa crea (o actualiza) un evento de dia completo que representa
// la banda de tiempo proyectada. Nunca duplica: usa event_id guardado en
// la hoja Etapas.
// ---------------------------------------------------------------------------

// Mapping estado → CalendarApp.EventColor
// Graphite = '8', Peacock/Cyan = '7', Basil/Green = '10'
var COLOR_MAP = {
  'GRAY':  '8',  // Graphite — pendiente
  'CYAN':  '7',  // Peacock  — en_curso
  'GREEN': '10'  // Basil    — hecho
};

function syncCalendar() {
  ensureSheets();
  recalcProgress();
  var proyeccion = proyectar();
  var cal = CalendarApp.getDefaultCalendar();

  proyeccion.forEach(function(etapa) {
    var title = 'Ciber \u00b7 ' + etapa.nombre;
    var inicio = etapa.inicio_proyectado;
    var fin = addDays_(etapa.fin_proyectado, 1); // fin exclusivo para all-day events
    var color = COLOR_MAP[etapa.color] || '8';

    var descLines = [];
    var tasks = getTasksByEtapa(etapa.id);
    tasks.forEach(function(t) {
      descLines.push((t.hecho ? '[x] ' : '[ ] ') + t.tarea);
    });
    descLines.push('');
    descLines.push('[ciber-band:' + etapa.id + ']');
    var description = descLines.join('\n');

    var event = null;

    // intentar recuperar evento existente por ID
    if (etapa.event_id) {
      try {
        event = cal.getEventById(etapa.event_id);
      } catch (e) {
        event = null;
      }
    }

    if (event) {
      // actualizar evento existente
      event.setTitle(title);
      event.setDescription(description);
      event.setColor(color);
      // mover fechas: borrar y recrear es mas confiable para all-day events
      // que no tienen setAllDayDates() en todos los runtimes
      try {
        event.setAllDayDates(inicio, fin);
      } catch (e) {
        // fallback: borrar y recrear
        event.deleteEvent();
        event = crearBanda_(cal, title, inicio, fin, description, color);
        updateEtapaEventId(etapa.id, event.getId());
      }
    } else {
      // crear banda nueva
      event = crearBanda_(cal, title, inicio, fin, description, color);
      updateEtapaEventId(etapa.id, event.getId());
    }
  });

  setSyncTimestamp();
}

function crearBanda_(cal, title, inicio, fin, description, color) {
  var event = cal.createAllDayEvent(title, inicio, fin);
  event.setDescription(description);
  event.setColor(color);
  return event;
}

// Borrar todas las bandas de ciber (cleanup manual)
function borrarTodasLasBandas() {
  var etapas = getEtapas();
  var cal = CalendarApp.getDefaultCalendar();

  etapas.forEach(function(etapa) {
    if (etapa.event_id) {
      try {
        var event = cal.getEventById(etapa.event_id);
        if (event) event.deleteEvent();
      } catch (e) {}
      updateEtapaEventId(etapa.id, '');
    }
  });
}
