# bitacora-ciber — brief de arranque (Claude Code)

> Pegá este archivo como primer prompt en Claude Code dentro de la carpeta `bitacora-ciber`, y dejalo commiteado como `CLAUDE.md` para que el contexto viaje entre PCs.

---

## 1. Qué estamos construyendo y para qué

Un sistema personal para trackear mi ruta de aprendizaje en ciberseguridad (objetivo lejano: OSCP) que **se adapta a mi avance real**. La idea central: dejo de pensar en fechas fijas y paso a una **proyección viva**. Yo tildo lo que voy terminando en un Google Sheet, y un script recalcula cuánto me falta y **reescribe el calendario solo**. Si avanzo más rápido, la fecha de llegada se corre hacia adelante y lo veo.

No es un to-do list genérico: es una **consola de misión** de mi camino a pentester. El tono y la UI tienen que reflejar eso.

## 2. Stack y mecánica (importante)

- **Google Apps Script** atado (bound) a un **Google Sheet**. El Sheet es la **fuente de verdad**.
- Desarrollo **local con `clasp`** (`@google/clasp`) para poder versionar en **GitHub** y trabajar desde otras PCs. El repo guarda el código `.gs`/`.html` + `appsscript.json`; con `clasp push` deploya al script del Sheet.
- El script lee el estado del Sheet, recalcula la proyección, y **escribe "bandas" en Google Calendar** (un evento de día completo por etapa, que se recolorea y se corre según mi avance).
- Se ejecuta con un **trigger diario** + un trigger **onEdit** (cuando tildo algo) + un botón de menú **"Sincronizar ahora"**.
- UI: un **sidebar de HtmlService** dentro del Sheet (dashboard estilo terminal). El diseño se hace aparte con `/claude-design` (ver sección 8) y después se porta a `Sidebar.html`.

## 3. Estructura del repo a crear

```
bitacora-ciber/
  .clasp.json            # apunta al Script ID (lo completo yo, ver sección 9)
  .claspignore
  appsscript.json        # manifest; declarar scope de Calendar
  src/
    Code.gs              # onOpen (menú), instalación de triggers, orquesta el sync
    SheetModel.gs        # leer/escribir el Sheet (etapas, tasks, settings, _sync)
    Scheduler.gs         # algoritmo de proyección de fechas (sección 6)
    CalendarSync.gs      # crear/actualizar/borrar bandas, idempotente (sección 7)
    Sidebar.html         # dashboard terminal (HtmlService)
  README.md
  CLAUDE.md              # este archivo
  .gitignore
```

## 4. El Google Sheet (fuente de verdad)

Crear (vía script en el primer setup, o documentar para que lo arme) estas hojas:

**`Settings`** (clave/valor):
- `fecha_inicio` = 2026-07-07
- `dias_sesion` = TU,TH (martes y jueves)
- `horario` = 13:00-14:30
- `zona_horaria` = America/Argentina/Buenos_Aires

**`Etapas`** (una fila por etapa, en orden):

| id | nombre | horas_estimadas | horas_semana | estado | progreso | fecha_fin_real | event_id |
|----|--------|-----------------|--------------|--------|----------|----------------|----------|
| b0 | Bloque 0 — Arranque | 4.5 | 1.5 | en_curso | (auto) | | (auto) |
| e1 | Etapa 1 — Bases | 45 | 3 | pendiente | (auto) | | (auto) |
| e2 | Etapa 2 — Kali + OSINT | 27 | 3 | pendiente | (auto) | | (auto) |
| e3 | Etapa 3 — Metodología ofensiva | 150 | 3 | pendiente | (auto) | | (auto) |
| e5 | Etapa 5 — Rubros/sectores | 6 | 3 | pendiente | (auto) | | (auto) |

- `estado` ∈ {pendiente, en_curso, hecho}. Editable a mano, pero también se autocompleta: si progreso llega a 100% → `hecho` y se estampa `fecha_fin_real` = hoy.
- `progreso` y `event_id` los maneja el script (no tocar a mano).
- Nota: la "Etapa 4 — Notetaking" NO es una etapa agendada, corre en paralelo desde la primera máquina de Etapa 3. No va en esta tabla (o va como nota informativa sin horas).

**`Tasks`** (los ítems tildables; el progreso de cada etapa = tildadas / total):

| etapa_id | tarea | hecho |
|----------|-------|-------|
| b0 | Responder teoría base de Etapa 1 (lectura) | ☐ |
| b0 | Armar vault de Obsidian + plantilla de máquina (formato Tyler Ramsbey) | ☐ |
| e1 | Teoría: IP y rangos | ☐ |
| e1 | Teoría: IP privada vs pública | ☐ |
| e1 | Teoría: dominio/subdominio/DNS | ☐ |
| e1 | Teoría: TCP vs UDP | ☐ |
| e1 | Teoría: puertos | ☐ |
| e1 | Teoría: qué es un servicio y dónde se sirve | ☐ |
| e1 | Teoría: HTTP vs HTTPS | ☐ |
| e1 | Teoría: qué es un CVE | ☐ |
| e1 | PortSwigger: labs SQLi | ☐ |
| e1 | PortSwigger: labs XSS | ☐ |
| e1 | PortSwigger: labs autenticación | ☐ |
| e1 | TryHackMe: ruta Pre Security | ☐ |
| e1 | TryHackMe: Introduction to Cyber Security | ☐ |
| e1 | THM: Linux Fundamentals 1-2-3 | ☐ |
| e2 | Instalar Kali en VM + estructura de archivos | ☐ |
| e2 | Teoría: comandos ls/cd/cat/sudo/cp/mv/mkdir/chmod/touch/nano | ☐ |
| e2 | Teoría: bash / reverse shell / RCE / Burp Suite | ☐ |
| e2 | THM OSINT: Sakura, OhSINT, Searchlight | ☐ |
| e2 | Herramientas: Sherlock, theHarvester, Shodan, dorks, Maltego CE | ☐ |
| e2 | Toolkit de Bellingcat | ☐ |
| e3 | THM: ruta Jr Penetration Tester | ☐ |
| e3 | HTB Academy: módulos gratis | ☐ |
| e3 | Burp + nmap + Wireshark en serio | ☐ |
| e3 | PicoCTF (primer CTF) | ☐ |
| e3 | HackTheBox: lista de TJ Null (en curso, varias máquinas) | ☐ |
| e3 | Contenido de S4vitar | ☐ |
| e5 | Definir rubro/sector y mapear mercado | ☐ |

(Las tareas de e3 son hitos gruesos; el progreso real lo da el tiempo invertido, así que más adelante quizá convenga dividir las máquinas de HTB en subtareas.)

**`_sync`** (hoja oculta, estado interno): última sincronización, IDs de eventos por etapa, logs.

## 5. Modelo de progreso

- `progreso(etapa)` = tareas hechas / tareas totales de esa etapa.
- `horas_restantes(etapa)`:
  - si `estado` = hecho → 0
  - si no → `horas_estimadas × (1 − progreso)`

## 6. Algoritmo de proyección (Scheduler.gs)

Esto es el corazón. Recalcula las fechas proyectadas de cada etapa:

1. `cursor` = max(hoy, `fecha_inicio`). Para etapas ya hechas, anclar al pasado con su `fecha_fin_real`.
2. Recorrer las etapas **en orden**:
   - Si está `hecho`: su banda va de su inicio real a `fecha_fin_real`, color verde. No mueve el cursor hacia el futuro (ya pasó).
   - Si no: `inicio_proyectado` = `cursor`. `semanas_necesarias` = ceil(`horas_restantes` / `horas_semana`). `fin_proyectado` = sumar esas semanas al cursor cayendo en días de sesión (`dias_sesion`). Luego `cursor` = `fin_proyectado` + pequeño gap (saltar feriados/fin de año si querés, ej. no arrancar entre 24/dic y 1/ene).
3. Devolver, por etapa: inicio_proyectado, fin_proyectado, estado, color.

El efecto buscado: cuando tildo tareas, `horas_restantes` baja, las semanas necesarias bajan, y **todas las etapas siguientes se corren hacia adelante automáticamente**.

## 7. Sync con Google Calendar (CalendarSync.gs)

- Por cada etapa, **una banda** = evento de día completo multi-día (`createAllDayEvent(titulo, inicio, fin)`; ojo que el `fin` es exclusivo).
- Título: `Ciber · <nombre etapa>`. En la descripción, las tareas de esa etapa + un tag interno `[ciber-band:<id>]`.
- **Color por estado**: pendiente = gris (Graphite), en_curso = celeste (Peacock), hecho = verde (Basil). Usar `event.setColor(CalendarApp.EventColor.*)`.
- **Idempotencia**: guardar el `event_id` de cada banda en la hoja `Etapas`/`_sync`. En cada sync: si existe el ID → traer el evento y actualizar fechas/color/título (moverlo); si no existe → crear y guardar el ID. Nunca duplicar.
- Si una etapa se borra o cambia mucho, borrar su banda vieja antes de recrear.

## 8. Triggers y menú (Code.gs)

- `onOpen`: crear menú personalizado **"Ciber"** con ítems: `Sincronizar ahora`, `Abrir panel` (sidebar), `Instalar trigger diario`.
- Trigger **time-driven diario** (una vez al día) → corre el sync (porque "hoy" cambia y la proyección se mueve).
- Trigger **onEdit** → si se editó una celda de `hecho` en `Tasks` o `estado` en `Etapas`, recalcular progreso y correr sync.
- Botón "Sincronizar ahora" en el menú y también en el sidebar.

## 9. Setup manual que hago YO (no lo automatices, requiere mi cuenta)

Documentá estos pasos en el README para que yo los siga:
1. Crear un Google Sheet nuevo → Extensiones → Apps Script (crea el script bound). Copiar el **Script ID**.
2. `npm i -g @google/clasp` → `clasp login` (autenticación con mi cuenta Google).
3. Habilitar la **Apps Script API** en mi cuenta.
4. Poner el Script ID en `.clasp.json`. `clasp push` para subir.
5. Autorizar los scopes (Sheet + Calendar) la primera vez que corra.

## 10. Orden de trabajo sugerido (iterar y commitear cada paso)

1. Scaffolding del repo + `appsscript.json` con scopes + `.gitignore` + README con el setup de la sección 9.
2. `SheetModel.gs`: crear las hojas con la seed data de arriba si no existen, y funciones de lectura/escritura.
3. `Scheduler.gs`: el algoritmo de proyección (sección 6), con una función de test que loguee las fechas proyectadas.
4. `CalendarSync.gs`: bandas idempotentes (sección 7).
5. `Code.gs`: menú + triggers.
6. `Sidebar.html`: dashboard (después de diseñarlo en /claude-design).

**Commitear después de cada paso** con mensajes claros. Repo público o privado en GitHub (lo creo yo).

---

## Brief aparte para `/claude-design` (la UI del sidebar)

Diseñar un **dashboard estilo consola/terminal** para el sidebar de HtmlService. Que se sienta como una *consola de misión* de mi ruta a pentester, NO como un panel corporativo ni como algo "generado por IA".

**Qué muestra:**
- Header tipo línea de prompt (ej. `angelo@ciber:~/ruta$ status`).
- Lista de etapas con su estado (pendiente / en curso / hecho), barra de progreso por etapa (sobria, puede ser tipo ASCII `[#####-----] 50%` si queda elegante), y las fechas proyectadas (inicio → fin).
- La etapa actual destacada.
- Fecha de llegada proyectada al final (la que se mueve según mi avance).
- Un botón/acción `> sincronizar`.

**Estética (clave — que no se zarpe):**
- Oscuro, monoespaciada de verdad (JetBrains Mono / IBM Plex Mono).
- Paleta apagada de terminal real (verdes/ámbar desaturados sobre casi-negro, o un theme tipo gruvbox/one-dark). **Un solo color de acento.**
- Nada de neón saturado, nada de gradientes decorativos, **sin emojis**, sin "glow" exagerado.
- Que respire: no recargar. Restraint > efectos.
- Densidad de info alta pero legible, como un `htop` o un `git status` bien diseñado.
