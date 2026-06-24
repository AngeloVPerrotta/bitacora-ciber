// ---------------------------------------------------------------------------
// CalendarSync.gs — bandas + sesiones idempotentes en Google Calendar
// ---------------------------------------------------------------------------
// Cada sync borra TODOS los eventos ciber del calendario y los recrea
// desde cero. Esto garantiza consistencia sin importar lo que haya
// quedado de iteraciones previas (huerfanos, formato viejo, etc.).
// Correr dos veces seguidas no duplica nada.
// ---------------------------------------------------------------------------

var TAG_MANAGED = '[ciber-managed]';

var COLOR_MAP = {
  'GRAY':  '8',  // Graphite — pendiente
  'CYAN':  '7',  // Peacock  — en_curso
  'GREEN': '10'  // Basil    — hecho
};

// ======================== ENTRY POINT ======================================

function syncCalendar() {
  var settings = getSettings();
  var proyeccion = proyectar();
  var cal = CalendarApp.getDefaultCalendar();

  // 1. SWEEP: borrar todo lo ciber del calendario
  limpiarEventosCiber_(cal, settings);

  // 2. RECREAR bandas all-day por etapa
  crearBandas_(cal, proyeccion);

  // 3. CREAR sesiones concretas (horizonte rodante ~8 semanas)
  crearSesiones_(cal, proyeccion, settings);

  setSyncTimestamp();
}

// ======================== SWEEP ============================================

function limpiarEventosCiber_(cal, settings) {
  var inicio = parseDateString_(settings.fecha_inicio || '2026-07-07');
  var fin = new Date(2028, 0, 1); // hasta fin de 2027

  var events = cal.getEvents(inicio, fin);
  var seriesBorradas = {};

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var title = ev.getTitle() || '';
    var desc = ev.getDescription() || '';

    if (title.indexOf('Ciber') === 0 || desc.indexOf(TAG_MANAGED) !== -1) {
      if (ev.isRecurringEvent()) {
        try {
          var series = ev.getEventSeries();
          var sid = series.getId();
          if (!seriesBorradas[sid]) {
            seriesBorradas[sid] = true;
            series.deleteEventSeries();
          }
        } catch (e) { /* serie ya borrada */ }
      } else {
        try { ev.deleteEvent(); } catch (e) {}
      }
    }
  }
}

// ======================== BANDAS ============================================

function crearBandas_(cal, proyeccion) {
  proyeccion.forEach(function(etapa) {
    var title = 'Ciber \u00b7 ' + etapa.nombre;
    var inicio = etapa.inicio_proyectado;
    var fin = addDays_(etapa.fin_proyectado, 1); // fin exclusivo
    var color = COLOR_MAP[etapa.color] || '8';

    var descLines = [];
    var tasks = getTasksByEtapa(etapa.id);
    tasks.forEach(function(t) {
      descLines.push((t.hecho ? '[x] ' : '[ ] ') + t.tarea);
    });
    descLines.push('');
    descLines.push(TAG_MANAGED);
    descLines.push('[ciber-band:' + etapa.id + ']');
    var description = descLines.join('\n');

    var event = cal.createAllDayEvent(title, inicio, fin);
    event.setDescription(description);
    event.setColor(color);
    updateEtapaEventId(etapa.id, event.getId());
  });
}

// ======================== SESIONES ==========================================

function crearSesiones_(cal, proyeccion, settings) {
  var ahora = new Date();
  var hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);

  // etapa activa = primera no completada
  var activa = null;
  for (var i = 0; i < proyeccion.length; i++) {
    if (proyeccion[i].estado !== 'hecho') {
      activa = proyeccion[i];
      break;
    }
  }
  if (!activa) return;

  // cadencia: horas_semana / horas_por_sesion = sesiones por semana
  var horario = settings.horario || '13:00-14:30';
  var horasSesion = calcHorasSesion_(horario);
  var sesionesXSemana = Math.max(1, Math.round(activa.horas_semana / horasSesion));

  // dias de sesion (tomar los primeros N segun cadencia)
  var diasDisponibles = (settings.dias_sesion || 'TU,TH').split(',').map(function(d) {
    return DAY_MAP[d.trim().toUpperCase()];
  });
  var diasActivos = diasDisponibles.slice(0, sesionesXSemana);

  // parsear horario
  var partes = horario.split('-');
  var hi = partes[0].split(':'), hf = partes[1].split(':');
  var hIni = parseInt(hi[0]), mIni = parseInt(hi[1]);
  var hFin = parseInt(hf[0]), mFin = parseInt(hf[1]);

  // horizonte: ~8 semanas desde hoy
  var limite = new Date(hoy);
  limite.setDate(limite.getDate() + 8 * 7);

  var d = new Date(hoy);
  while (d <= limite) {
    if (diasActivos.indexOf(d.getDay()) !== -1 && !enHolidayZone_(d)) {
      var startTime = new Date(d);
      startTime.setHours(hIni, mIni, 0, 0);

      // no crear sesiones en el pasado
      if (startTime > ahora) {
        var endTime = new Date(d);
        endTime.setHours(hFin, mFin, 0, 0);

        var fechaStr = Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
        var title = 'Ciber \u00b7 sesi\u00f3n \u2014 ' + activa.nombre;
        var desc = TAG_MANAGED + '\n[ciber-session:' + fechaStr + ']';

        var ev = cal.createEvent(title, startTime, endTime);
        ev.setDescription(desc);
        ev.addPopupReminder(10);
      }
    }
    d.setDate(d.getDate() + 1);
  }
}

// ======================== CLEANUP MANUAL ====================================

function borrarTodasLasBandas() {
  var settings = getSettings();
  var cal = CalendarApp.getDefaultCalendar();
  limpiarEventosCiber_(cal, settings);

  var etapas = getEtapas();
  etapas.forEach(function(etapa) {
    updateEtapaEventId(etapa.id, '');
  });
}
