// ---------------------------------------------------------------------------
// Scheduler.gs — algoritmo de proyeccion de fechas
// ---------------------------------------------------------------------------
// Recorre las etapas en orden y asigna inicio/fin proyectado a cada una.
// Cuando tildas tareas, horas_restantes baja y todas las etapas siguientes
// se corren hacia adelante automaticamente.
// ---------------------------------------------------------------------------

var DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function proyectar() {
  var settings = getSettings();
  var etapas = getEtapas();

  var fechaInicio = parseDateString_(settings.fecha_inicio || '2026-07-07');
  var diasSesion = (settings.dias_sesion || 'TU,TH').split(',').map(function(d) {
    return DAY_MAP[d.trim().toUpperCase()];
  });
  var horasSesion = calcHorasSesion_(settings.horario || '13:00-14:30');

  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  var cursor = new Date(Math.max(hoy.getTime(), fechaInicio.getTime()));

  var resultado = [];

  for (var i = 0; i < etapas.length; i++) {
    var etapa = etapas[i];
    var entry = {
      id:       etapa.id,
      nombre:   etapa.nombre,
      estado:   etapa.estado,
      progreso: etapa.progreso || 0,
      horas_estimadas: etapa.horas_estimadas,
      horas_semana:    etapa.horas_semana,
      event_id: etapa.event_id || '',
      _row:     etapa._row
    };

    if (etapa.estado === 'hecho') {
      // etapa ya completada: anclar al pasado
      entry.inicio_proyectado = fechaInicio; // placeholder — no importa mucho
      entry.fin_proyectado = etapa.fecha_fin_real
        ? parseDateString_(etapa.fecha_fin_real)
        : hoy;
      entry.color = 'GREEN';
    } else {
      var horasRestantes = etapa.horas_estimadas * (1 - (etapa.progreso || 0));
      var sesionesNecesarias = Math.ceil(horasRestantes / horasSesion);
      if (sesionesNecesarias < 1) sesionesNecesarias = 1;

      entry.inicio_proyectado = new Date(cursor);
      var fin = avanzarSesiones_(cursor, sesionesNecesarias, diasSesion);
      entry.fin_proyectado = fin;
      entry.color = etapa.estado === 'en_curso' ? 'CYAN' : 'GRAY';

      // mover cursor al dia siguiente a fin para la proxima etapa
      cursor = addDays_(fin, 1);
      // saltar holiday zone (24/dic — 1/ene)
      cursor = skipHolidayZone_(cursor);
    }

    resultado.push(entry);
  }

  return resultado;
}

// ======================== HELPERS ==========================================

function parseDateString_(str) {
  if (str instanceof Date) return str;
  var parts = String(str).split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function calcHorasSesion_(horario) {
  var parts = horario.split('-');
  var ini = parts[0].split(':');
  var fin = parts[1].split(':');
  var h1 = parseInt(ini[0]) + parseInt(ini[1]) / 60;
  var h2 = parseInt(fin[0]) + parseInt(fin[1]) / 60;
  return h2 - h1;
}

function addDays_(date, n) {
  var d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function avanzarSesiones_(desde, sesiones, diasSesion) {
  var d = new Date(desde);
  var count = 0;
  // limite de seguridad: max 2000 dias (~5 anios)
  for (var safety = 0; safety < 2000 && count < sesiones; safety++) {
    if (esDiaDeSesion_(d, diasSesion) && !enHolidayZone_(d)) {
      count++;
      if (count >= sesiones) return new Date(d);
    }
    d = addDays_(d, 1);
  }
  return new Date(d);
}

function esDiaDeSesion_(date, diasSesion) {
  return diasSesion.indexOf(date.getDay()) !== -1;
}

function enHolidayZone_(date) {
  var m = date.getMonth(); // 0-indexed
  var day = date.getDate();
  // 24 dic a 1 ene (inclusive)
  return (m === 11 && day >= 24) || (m === 0 && day <= 1);
}

function skipHolidayZone_(date) {
  var d = new Date(date);
  while (enHolidayZone_(d)) {
    d = addDays_(d, 1);
  }
  return d;
}

// ======================== TEST ==============================================

function testProyeccion() {
  ensureSheets();
  recalcProgress();
  var p = proyectar();
  p.forEach(function(e) {
    var ini = Utilities.formatDate(e.inicio_proyectado, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    var fin = Utilities.formatDate(e.fin_proyectado, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    Logger.log('%s | %s | %s → %s | %s | %s%%',
      e.id, e.nombre, ini, fin, e.estado,
      Math.round(e.progreso * 100));
  });
}
