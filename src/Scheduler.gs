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
      sesiones_semana:   0,  // cadencia derivada de horas_semana (se llena abajo)
      semanas_necesarias: 0,
      event_id: etapa.event_id || '',
      _row:     etapa._row
    };

    if (esParalela_(etapa)) {
      // etapa PARALELA (horas_semana = 0): figura en el panel pero NO consume
      // cronograma ni mueve el cursor. Ej: Etapa 4 — Notetaking (corre junto
      // a las demas, no es una banda agendada). El cursor queda intacto.
      entry.inicio_proyectado = new Date(cursor);
      entry.fin_proyectado = new Date(cursor);
      entry.color = etapa.estado === 'hecho'
        ? 'GREEN'
        : (etapa.estado === 'en_curso' ? 'CYAN' : 'GRAY');
      entry.paralela = true;
    } else if (etapa.estado === 'hecho') {
      // etapa ya completada: anclar al pasado
      entry.inicio_proyectado = fechaInicio; // placeholder — no importa mucho
      entry.fin_proyectado = etapa.fecha_fin_real
        ? parseDateString_(etapa.fecha_fin_real)
        : hoy;
      entry.color = 'GREEN';
    } else {
      // ---- etapa SECUENCIAL: la cadencia sale de horas_semana ----
      var horasRestantes = etapa.horas_estimadas * (1 - (etapa.progreso || 0));
      var horasSemana = Number(etapa.horas_semana) || horasSesion;

      // cadencia (sesiones/semana y en que dias caen) derivada de horas_semana,
      // misma formula que usa CalendarSync para las sesiones concretas: asi la
      // banda y las sesiones SIEMPRE coinciden. Ej: 1.5h/sem ÷ 1.5h/sesion = 1
      // sesion/sem; 3h/sem = 2 sesiones/sem. No se hardcodea.
      var cad = cadenciaSemanal_(horasSemana, horasSesion, diasSesion);

      // semanas necesarias a ese ritmo semanal
      var semanasNecesarias = Math.max(1, Math.ceil(horasRestantes / horasSemana));

      // inicio = primer dia de sesion (activo) en/desde el cursor
      var inicio = primerDiaDeSesion_(cursor, cad.diasActivos);
      // fin = inicio + semanas_necesarias semanas, cayendo en un dia de sesion
      var fin = primerDiaDeSesion_(addDays_(inicio, semanasNecesarias * 7), cad.diasActivos);

      entry.inicio_proyectado = inicio;
      entry.fin_proyectado = fin;
      entry.sesiones_semana = cad.sesionesXSemana;
      entry.semanas_necesarias = semanasNecesarias;
      entry.color = etapa.estado === 'en_curso' ? 'CYAN' : 'GRAY';

      // cursor para la proxima etapa: dia siguiente al fin, saltando holiday zone
      cursor = skipHolidayZone_(addDays_(fin, 1));
    }

    resultado.push(entry);
  }

  return resultado;
}

// ======================== HELPERS ==========================================

function esParalela_(etapa) {
  // Una etapa con horas_semana = 0 corre en paralelo: no ocupa cronograma.
  return Number(etapa.horas_semana) === 0;
}

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

// Cadencia semanal derivada de horas_semana (NO se hardcodea): cuantas sesiones
// por semana y en que dias de sesion caen. La usan tanto Scheduler (proyeccion
// + bandas) como CalendarSync (sesiones concretas), de modo que la ventana de la
// banda y las sesiones del calendario SIEMPRE coinciden.
//   horas_semana 1.5 ÷ horas_sesion 1.5 = 1 sesion/sem  -> primer dia de sesion
//   horas_semana 3   ÷ horas_sesion 1.5 = 2 sesiones/sem -> los dos dias
function cadenciaSemanal_(horasSemana, horasSesion, diasSesion) {
  var sesionesXSemana = Math.max(1, Math.round(Number(horasSemana) / horasSesion));
  return {
    sesionesXSemana: sesionesXSemana,
    diasActivos: diasSesion.slice(0, sesionesXSemana)
  };
}

// Primer dia >= desde que es dia de sesion (de la lista dada) y no cae en la
// holiday zone (24/dic — 1/ene).
function primerDiaDeSesion_(desde, dias) {
  var d = new Date(desde);
  // limite de seguridad: ~5 anios
  for (var safety = 0; safety < 2000; safety++) {
    if (esDiaDeSesion_(d, dias) && !enHolidayZone_(d)) return d;
    d = addDays_(d, 1);
  }
  return d;
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
  var tz = 'America/Argentina/Buenos_Aires';
  var p = proyectar();
  p.forEach(function(e) {
    var ini = Utilities.formatDate(e.inicio_proyectado, tz, 'yyyy-MM-dd');
    var fin = Utilities.formatDate(e.fin_proyectado, tz, 'yyyy-MM-dd');
    var cad = e.paralela
      ? 'paralela'
      : (e.estado === 'hecho'
          ? 'hecho'
          : e.semanas_necesarias + ' sem @ ' + e.sesiones_semana + ' ses/sem');
    Logger.log('%s | %s | %s → %s | %s | %s | %s%%',
      e.id, e.nombre, ini, fin, cad, e.estado,
      Math.round(e.progreso * 100));
  });
}
