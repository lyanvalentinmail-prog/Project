# 𓆩 ☕ 𓆪 VÉRSOVA en Termux (Android)

Con Termux, VÉRSOVA (el bot y el panel web) funciona en un teléfono Android igual que
en un PC o un VPS. No hace falta root ni compilar nada.

> **Resumen rápido**
>
> ```bash
> pkg update -y && pkg install -y git
> git clone https://github.com/lyanvalentinmail-prog/Project.git ~/versova
> cd ~/versova && bash scripts/termux-setup.sh
> npm run termux
> ```
>
> Después abre **http://localhost:3000** en el navegador del teléfono y vincula tu bot.

---

## 1 · Qué necesitas

| | |
|---|---|
| **Android** | 7 o superior |
| **Termux** | Desde [F-Droid](https://f-droid.org/packages/com.termux/) o desde [GitHub](https://github.com/termux/termux-app/releases) (variante `apt-android-7`). La versión de Google Play es experimental y le faltan funciones. |
| **Espacio** | ~600 MB libres (Termux + Node.js + dependencias) |
| **Internet** | Wi-Fi o datos móviles; el bot necesita conexión permanente con WhatsApp |
| **WhatsApp** | Un número para el bot (mejor uno secundario) |

No mezcles instalaciones de distintas fuentes: F-Droid y GitHub firman con claves
distintas. Si cambias de fuente, desinstala antes Termux y sus plugins.

No hace falta instalar Termux:API.

---

## 2 · Instalación (una sola vez)

Abre Termux y ejecuta:

```bash
pkg update -y && pkg install -y git
git clone https://github.com/lyanvalentinmail-prog/Project.git ~/versova
cd ~/versova
bash scripts/termux-setup.sh
```

El script `termux-setup.sh` (también disponible como `npm run termux:setup`):

1. actualiza los paquetes de Termux (`pkg update` + `pkg upgrade`);
2. instala **Node.js LTS**, **npm** y **git** si faltan (cualquier Node ≥ 22.13 sirve);
3. instala las dependencias del bot con `npm install --omit=optional`. **No compila
   nada**: en Android la base de datos usa el SQLite integrado en Node (`node:sqlite`)
   en lugar del módulo nativo `better-sqlite3`;
4. crea el `.env` y te pide tu número de **owner** (con código de país, sin `+`);
5. ejecuta el diagnóstico (`npm run doctor`).

Puedes volver a ejecutarlo cuando quieras: no borra nada.
Con `SKIP_UPGRADE=1 bash scripts/termux-setup.sh` se salta la actualización del sistema.

> ⚠ **El proyecto debe estar dentro de la carpeta de Termux (`~`), no en `/sdcard`.**
> En el almacenamiento compartido npm no puede crear enlaces y SQLite no puede
> bloquear archivos. El script se niega a instalar ahí y te dice cómo moverlo.

---

## 3 · Arrancar el bot

```bash
cd ~/versova
npm run termux
```

`npm run termux`:

- arranca el **bot y el panel web**;
- activa `termux-wake-lock` para que Android no duerma el proceso (verás la
  notificación de Termux con *wake lock held*);
- **reinicia el bot solo** si se cae (por defecto espera 5 s; cámbialo con
  `RESTART_DELAY=10 npm run termux`). Si falla 5 veces seguidas nada más arrancar,
  se detiene y muestra el error;
- se detiene del todo con **Ctrl+C** (en el teclado de Termux: `CTRL` + `c`).

Al arrancar verás algo así:

```
✓ Bot VÉRSOVA v1.0 · prefijos # - + . / (por sub-bot)
☕ Plataforma     ⁙ Termux (Android) · Node v24.x · arm64
☕ Motor          ⁙ node:sqlite (integrado en Node) · SQLite 3.x · WAL
☕ Comandos       ⁙ 53 registrados
☕ Panel web      ⁙ http://localhost:3000
☕ En tu red      ⁙ http://192.168.1.50:3000
☕ Termux         ⁙ deja Termux abierto o en segundo plano y desactiva la optimización de batería
```

Solo puede haber **una copia de VÉRSOVA en marcha por carpeta de datos**: si lo lanzas
otra vez (por ejemplo, desde otra sesión de Termux), la segunda copia se niega a
arrancar y te dice el PID de la primera. Así no se pelean por la sesión de WhatsApp.

Otras formas:

| Comando | Qué hace |
|---|---|
| `npm run termux` | Bot + panel, con wake lock y reinicio automático (recomendado) |
| `npm run termux -- --no-web` | Solo el bot, sin panel web |
| `npm start` | Bot + panel sin supervisión (si se cae, no vuelve) |

---

## 4 · Vincular WhatsApp

Tienes tres caminos; todos dan códigos **reales** emitidos por WhatsApp.

### A · Desde el panel web (el más cómodo)

1. Con `npm run termux` en marcha, abre **http://localhost:3000** en el navegador
   del teléfono (Chrome, Firefox…).
2. **Registrar** → nombre, prefijo, número del bot (ej. `5215512345678`) y método.
3. **Conectar en WhatsApp** → el panel muestra el pairing code (o el QR).

### B · Desde la propia terminal, mientras el bot está en marcha

Los pairing codes y los cambios de estado **se imprimen en la consola de Termux**.
El QR también se dibuja con caracteres cuando la salida es una terminal
(`TERMINAL_QR=true` lo fuerza y `TERMINAL_QR=false` lo desactiva).

### C · Asistente de terminal (sin navegador)

Detén antes el bot (Ctrl+C) y ejecuta:

```bash
npm run vincular
# o directamente:
npm run vincular -- --numero 5215512345678 --nombre "Mi bot" --prefijo .
```

El asistente crea (o elige) el sub-bot, pide el código y espera a que quede
conectado. Al terminar te dice que arranques con `npm run termux`.
Con `--qr` dibuja el QR en vez del código.

### ¿Código o QR?

- **Pairing code (recomendado en Termux)**: si Termux corre en el mismo teléfono que
  tiene la cuenta de WhatsApp del bot, copia el código, abre WhatsApp →
  *Ajustes → Dispositivos vinculados → Vincular un dispositivo → Vincular con el número
  de teléfono* y escríbelo. Caduca en ~60 s: el panel lo renueva solo.
- **QR**: necesitas otra pantalla para escanearlo (por ejemplo, abre el panel desde un
  PC de tu red y escanéalo con el teléfono del bot).

---

## 5 · Abrir el panel desde otro dispositivo

El panel escucha en todas las interfaces (`WEB_HOST=0.0.0.0`). Desde un PC o tablet
conectado **a la misma Wi-Fi**, abre la dirección que aparece en el arranque, por ejemplo
`http://192.168.1.50:3000`.

> 🔒 El panel **no tiene contraseña** (está abierto por diseño). En redes que no sean
> tuyas (Wi-Fi pública, trabajo…), limita el acceso al propio teléfono añadiendo esto
> al `.env`:
>
> ```
> WEB_HOST=127.0.0.1
> ```

`WEB_PORT` debe ser **1024 o mayor** (Android no deja usar puertos bajos sin root).

---

## 6 · Que no se duerma (24/7)

Android cierra las apps en segundo plano para ahorrar batería. Para que el bot siga
conectado:

1. **Usa `npm run termux`**: activa el wake lock automáticamente.
   (Manual: `termux-wake-lock`; para soltarlo: `termux-wake-unlock`.)
2. **Quita la optimización de batería de Termux**: *Ajustes → Aplicaciones → Termux →
   Batería → Sin restricciones* (el nombre exacto cambia según la marca; consulta
   [dontkillmyapp.com](https://dontkillmyapp.com) para la tuya).
3. **No cierres Termux** desde la lista de apps recientes ni pulses *Exit* en su
   notificación.
4. **Android 12 o superior**: si Termux se cierra con
   `[Process completed (signal 9) - press Enter]`, es el *phantom process killer* de Android:
   - **Android 14+**: activa *Opciones de desarrollador → Disable child process
     restrictions* (en español suele aparecer como «Inhabilitar restricciones de
     procesos secundarios»). Tienes que mantener activadas las opciones de
     desarrollador.
   - **Android 12L / 13** (con `adb` desde un PC o con `pkg install android-tools`):
     ```bash
     adb shell "settings put global settings_enable_monitor_phantom_procs false"
     ```
   - **Android 12**: consulta la
     [guía de Termux](https://github.com/agnostic-apollo/Android-Docs/blob/master/en/docs/apps/processes/phantom-cached-and-empty-processes.md#commands-to-disable-phantom-process-killing-and-tldr).

VÉRSOVA usa muy pocos procesos (bash + node), así que normalmente basta con los
puntos 1 y 2.

---

## 7 · Actualizar

```bash
cd ~/versova
git pull
npm run termux:setup        # o, más rápido: npm install --omit=optional
npm run termux
```

Tus bots, la base de datos (`data/`) y las sesiones de WhatsApp (`sessions/`) se
conservan: no hace falta volver a vincular.

---

## 8 · Copia de seguridad

Con el bot detenido (Ctrl+C):

```bash
termux-setup-storage            # una sola vez: da acceso a la memoria del teléfono
cd ~/versova
tar czf ~/storage/downloads/versova-backup.tgz data sessions .env
```

Para restaurar en otra instalación: copia el archivo a `~/versova` y ejecuta
`tar xzf versova-backup.tgz`.

> ⚠ La copia **contiene la sesión de WhatsApp** del bot: guárdala en un lugar privado.
> Y no ejecutes la misma sesión en dos dispositivos a la vez (ver abajo).

---

## 9 · Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Este script es para Termux (Android)` | Estás en un PC/VPS: usa `npm install && npm start`. |
| `El proyecto está en el almacenamiento compartido` | Muévelo al HOME: `cd ~ && git clone … versova`. |
| Errores de `node-gyp` / `better-sqlite3` al instalar | Usa `npm install --omit=optional` (es lo que hace el script). En Termux no hace falta ese módulo. |
| `Se necesita Node.js 22.13 o superior` | `pkg upgrade -y && pkg install -y nodejs-lts` |
| `npm: command not found` | `pkg install -y npm` (en Node LTS reciente npm va aparte). |
| `VÉRSOVA ya está en marcha con estos mismos datos (PID …)` | Hay otra copia abierta, quizá en otra sesión de Termux (desliza desde el borde izquierdo para verlas). Usa esa o ciérrala con Ctrl+C o `kill <PID>`. |
| `puerto 3000 ocupado, probando 3001` | Otro programa usa ese puerto: el panel se abre en el siguiente libre (mira la URL que muestra el arranque) o fija otro con `WEB_PORT`. |
| `sin permiso para usar el puerto` | Usa un `WEB_PORT` de 1024 o más. |
| `Modo solo bot (--no-web): no hay sub-bots vinculados` | Sin panel no se puede vincular: usa `npm run vincular` o arranca con `npm run termux`. |
| `sin conexión con WhatsApp (408)` | Sin internet, ahorro de datos activado o red que bloquea WhatsApp. El bot reintenta solo. |
| `la sesión se abrió en otro lugar (440)` | La misma sesión está abierta en otro equipo (por ejemplo, copiaste `sessions/` a un PC, o el bot sigue en Render). El bot **no** se reconecta solo para no pelearse: deja una sola copia en marcha y pulsa *Conectar* en el panel. |
| `la sesión se cerró desde el teléfono` | Quitaste el dispositivo vinculado en WhatsApp (401): vuelve a vincular. |
| `[Process completed (signal 9)]` | Android mató Termux: revisa la sección 6. |
| El panel no abre desde el PC | Mismo Wi-Fi, `WEB_HOST=0.0.0.0` y la IP que muestra el arranque. Algunas redes aíslan a los clientes entre sí. |

Diagnóstico completo en cualquier momento: `npm run doctor`.

---

## 10 · Variables útiles (`.env`)

| Variable | Por defecto | Para qué |
|---|---|---|
| `OWNER_NUMBERS` | — | Tu número (owner), con código de país y sin `+` |
| `WEB_PORT` | `3000` | Puerto del panel (≥ 1024 en Android) |
| `WEB_HOST` | `0.0.0.0` | `127.0.0.1` = panel solo en el propio teléfono |
| `TERMINAL_QR` | `auto` | Dibujar el QR en la consola: `auto` (si es terminal), `true`, `false` |
| `DB_DRIVER` | `auto` | Motor SQLite: `auto`, `node` (integrado) o `better-sqlite3` |
| `DB_JOURNAL_MODE` | `WAL` | Diario de SQLite; si no se puede usar WAL, pasa solo a `DELETE` |
| `RESTART_DELAY` | `5` | Segundos entre reinicios de `npm run termux` |
| `LINK_TIMEOUT_MS` | `300000` | Tiempo máximo de espera de `npm run vincular` |
