<div align="center">

ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙
ㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪
ㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨
ㅤㅤ◢禍◣ Versova ࿙☕࿚

**Bot de WhatsApp para administración de teams de rol + panel web para gestionar hasta 3 sub-bots.**

`Registro · Personajes · Gestión · Interacción · Administración · Base de datos persistente`

[![Node](https://img.shields.io/badge/node-%E2%89%A522.13-8fbc72)](https://nodejs.org)
[![Termux](https://img.shields.io/badge/Termux-Android-8fbc72)](docs/TERMUX.md)
[![Baileys](https://img.shields.io/badge/baileys-7.0.0--rc14-c8a27a)](https://github.com/WhiskeySockets/Baileys)
[![tests](https://img.shields.io/badge/tests-248%20pass-8fbc72)](#pruebas)
[![version](https://img.shields.io/badge/versi%C3%B3n-1.0-e8c9a0)](#)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lyanvalentinmail-prog/Project)

</div>

---

## 𓆩 ☕ 𓆪 Qué es

VÉRSOVA es un bot **completo, modular y estable** para gestionar teams de rol dentro de
grupos de WhatsApp: registro de integrantes con ficha, asignación de personajes con
aprobación del staff, reservas temporales, parejas, AFK, control de inactividad,
moderación con advertencias y baneos, y una estética propia (dark, japonesa, con café).

Incluye además un **panel web** para administrar tus bots: crear hasta **3 sub-bots con
números distintos** y vincular cada uno con **QR o pairing code**, ver grupos, integrantes,
personajes y aprobar solicitudes desde el navegador.

> Todo es funcional: no hay comandos de adorno ni respuestas simuladas. Cuando WhatsApp
> impide algo, el bot lo dice y explica el motivo real ([limitaciones](docs/LIMITACIONES.md)).

---

## 𓆩 𖤐 𓆪 Requisitos

- **Node.js 22.13 o superior** (`node -v`)
- Un **número de WhatsApp** por sub-bot (recomendado: números secundarios dedicados)
- Que ese número **te permita ser administrador** en los grupos donde quieras moderar
- npm (viene con Node)

Funciona en **Windows, macOS, Linux, un VPS, Render y Android (Termux)**. La base de
datos es SQLite: se usa `better-sqlite3` si está instalado y, si no (o si no se puede
compilar, como en Android), el SQLite integrado en Node. Nada que configurar.

---

## 𓆩 🥢 𓆪 Instalación

```bash
# 1 · dependencias
npm install

# 2 · configuración
cp .env.example .env
#    edita OWNER_NUMBERS con tu número (formato internacional sin "+"):
#    OWNER_NUMBERS=5215512345678

# 3 · diagnóstico del entorno (opcional pero recomendado)
npm run doctor

# 4 · arrancar bot + panel web
npm start
```

Al arrancar verás algo así:

```
✓ Bot VÉRSOVA v1.0 · prefijos # - + . / (por sub-bot)
☕ Plataforma     ⁙ Linux · Node v22.x · x64
☕ Base de datos  ⁙ /ruta/al/proyecto/data/versova.db
☕ Motor          ⁙ better-sqlite3 · SQLite 3.x · WAL
☕ Comandos       ⁙ 53 registrados
☕ Panel web      ⁙ http://localhost:3000
☕ En tu red      ⁙ http://192.168.1.50:3000
⚠ No hay sub-bots con inicio automático. Abre el panel web y vincula uno con WhatsApp.
```

Solo puede haber **una copia en marcha por carpeta de datos**: si lo lanzas dos veces,
la segunda se niega a arrancar (dos copias con la misma sesión de WhatsApp se
desconectan entre sí).

---

## 𓆩 📱 𓆪 Android (Termux)

VÉRSOVA también corre en un teléfono Android con [Termux](https://f-droid.org/packages/com.termux/)
(instálalo desde F-Droid o GitHub, no desde Google Play). Sin root y sin compilar nada:

```bash
pkg update -y && pkg install -y git
git clone https://github.com/lyanvalentinmail-prog/Project.git ~/versova
cd ~/versova && bash scripts/termux-setup.sh     # Node.js, dependencias, .env y diagnóstico
npm run termux                                   # bot + panel, con wake lock y reinicio automático
```

Abre **http://localhost:3000** en el navegador del teléfono para vincular el bot, o hazlo
desde la propia terminal con `npm run vincular` (pairing code o QR en la consola).
Para actualizar: `git pull && npm run termux:setup`.

Guía completa (batería, Android 12+, copias de seguridad, problemas frecuentes):
**[docs/TERMUX.md](docs/TERMUX.md)**.

---

## 𓆩 ♡ 𓆪 Crear y vincular un bot

1. Abre el panel: **http://localhost:3000** (en un servidor remoto, el puerto 3000).
   **No hay contraseña**: el panel está abierto por diseño.
2. En **Registrar bot**: nombre, **prefijo de comandos** (`#` `-` `+` `.` `/`),
   número internacional sin `+` (ej. `5215512345678`) y método de vinculación.
   El bot se crea **desconectado**.
3. Pulsa **Conectar en WhatsApp**. El panel obtiene directamente el QR o código de
   vinculación. **No necesitas enviar `.key` ni pegar una clave de activación.**
4. **Vincula el número**: los QR y pairing codes son **reales** (los emite WhatsApp).
   - **QR** → se muestra en la ventana y se renueva solo; escanéalo en
     *WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo*.
   - **Pairing code** → el panel lo pide a WhatsApp (botón *Pedir pairing code*) y
     también te lo entrega el bot por WhatsApp con `.pairing` (o `.key`). Aparece como
     `ABCD-1234`; en el teléfono ve a *Dispositivos vinculados → Vincular un dispositivo
     → Vincular con el número de teléfono* y escríbelo. Caduca en ~60 s: el panel lo
     renueva solo y `.pairing` te da otro al momento.
5. Cuando el estado pase a **en línea**, añade el bot a tu grupo de rol y escribe
   `«prefijo»menu` (ej. `.menu` o `#menu` según el prefijo elegido).

Puedes enviar comandos desde otro número **o desde el propio teléfono vinculado**.
En privado, prueba `«prefijo»ping` o `«prefijo»menu`; registro, roles y moderación
se usan dentro del grupo. Tras actualizar el código, reinicia el proceso del bot
para cargar los cambios (no hace falta borrar la sesión ni volver a vincular).

Los bots antiguos también quedan habilitados al actualizar. Se conserva su configuración
de inicio automático; los bots detenidos no se arrancan por la migración.

### Administradores del bot (staff only)

En **Mis Bots → Editar → Números de admins · staff only**, agrega los números de
WhatsApp con código de país, **uno por línea o separados por comas** (ej.
`+598 99 123 456`). Se aceptan hasta 50 números por bot y los duplicados se eliminan.
Pulsa **Guardar cambios**: el permiso se aplica desde el siguiente mensaje, sin
reiniciar ni volver a vincular. Para revocarlo, borra el número y vuelve a guardar.

- Pueden usar los comandos de administración de **ese sub-bot** (aprobar personajes,
  advertir, anuncios, etc.), aunque no sean administradores del grupo.
- No reciben rango de owner, permisos sobre otros sub-bots ni un ascenso en WhatsApp.
- La lista queda en SQLite y sobrevive a reinicios y sincronizaciones de participantes.
- Los admins reales del grupo y los owners de `OWNER_NUMBERS` conservan sus permisos.
  El número del **bot** debe seguir siendo admin en WhatsApp para expulsar, añadir
  participantes o cerrar/abrir grupos; esta lista no permite escribir en un grupo
  cerrado si WhatsApp no lo autoriza.

El panel sigue abierto por diseño: limita su acceso a personas de confianza.

### 𓆩 🎨 𓆪 Personaliza tu bot desde la web (editor de menú)

En **Mis Bots → Editar** cada sub-bot tiene su propio editor de menú:

- **Banner del menú** (pestaña *Estilo*): pega la URL de una imagen o súbela desde tu
  dispositivo (PNG, JPG o WebP, máx. 1 MB; el navegador la comprime solo). El menú se
  envía con esa imagen encima.
- **Modo de entrega** (pestaña *Estilo*): elige **💬 Texto decorado** (los 7 estilos
  de siempre) o **📋 Lista interactiva**: el bot manda su info con un botón que abre el
  menú de lista nativo de WhatsApp para elegir la categoría (list message). Si el
  cliente no muestra listas, cae a texto automáticamente.
- **Categorías** (pestaña *Categorías*): quita o vuelve a poner cualquier sección del
  menú con un interruptor (incluidas las del sistema). Una categoría apagada no
  aparece en el menú y sus comandos dejan de responder. También puedes crear
  categorías nuevas y borrar las tuyas.
- **Comandos** (pestaña *Comandos*): interruptor maestro por categoría a la derecha de
  cada grupo (apagar = la categoría entera se desactiva), y fila a fila para un
  comando suelto. Cuando una categoría está apagada, las filas se muestran con la
  etiqueta **CATEGORÍA OFF**.
- Todo se guarda en SQLite por sub-bot con **Guardar cambios** y se aplica desde el
  siguiente comando, sin reiniciar ni volver a vincular.

Los comandos de **logos** (`.logoneon`, `.logooro`, …) generan ahora el PNG **en el
propio bot** (25 efectos, fuente pixel 5×7, sin APIs externas) y lo envían como imagen.
La búsqueda **`.ssearch <texto>`** consulta sticker.ly y sube hasta 5 stickers del pack
que elijas; **`.play` / `.ytmp3` / `.tiktok` / `.instagram` / `.spotify` /
`.pinterest` / `.lyrics`** buscan de verdad y, si la fuente externa no responde o no
hay red, recibes la tarjeta con los enlaces listos para tocar (nunca solo “sin conexión”).
`.play` intenta descargar el audio mediante el servicio público **cobalt**
(configurable con `COBALT_INSTANCES` en el `.env`).

### 𓆩 ✨ 𓆪 Panel web sin parpadeos

El panel se conecta al servidor por SSE y **solo repinta lo que cambió**: si nada se
mueve, el DOM queda intacto (antes se redibujaba con cada evento de Baileys y parecía
que la página se recargaba sola cada segundo). Además:

- los formularios **nunca pierden el foco** mientras escribes;
- el pairing code se muestra con cuenta atrás de 60 s, botón de copiar y renovación
  automática cuando caduca;
- el sondeo de respaldo es lento y se detiene cuando la pestaña está oculta;
- la interfaz usa componentes de **[uiverse.io](https://uiverse.io)** (MIT) adaptados a
  la paleta del proyecto: botón con glow, loader átomo, switch hamburguesa y tarjetas
  con icono degradado.

### 𓆩 🔑 𓆪 API funcional, cuentas y API keys

En la página **Endpoints** del panel hay pestañas:

| Pestaña | Qué hace |
|---|---|
| **Funcionales** | 38 endpoints propios que responden de verdad (nada simulado), con buscador y un probador en vivo (rellena parámetros → *Probar* → ves el JSON o la imagen). |
| **Mis API Keys** | Iniciar sesión / registrarse, crear keys (**máximo 100 días**), renovarlas, revocarlas y ver el uso reciente. |
| **Catálogo** | El catálogo externo de antes. |
| **Owner** | Solo para `lyanvalentinmail@gmail.com`: usuarios, keys activas, peticiones y endpoints más usados; puede revocar keys o eliminar cuentas. |

**Endpoints** (todos `GET`, base `/api/v1`, CORS abierto; `GET /api/v1` lista el catálogo sin key):

- Texto: `/text/reverse` `/text/case` `/text/count` `/text/slug` `/text/fancy` `/text/leet` `/text/morse` `/text/palindrome`
- Codificación: `/encode/base64` `/encode/url` `/encode/hex` `/encode/binary` `/crypto/hash` `/crypto/uuid` `/crypto/password`
- Matemáticas y conversión: `/math/calc` (sin `eval`) `/math/random` `/math/prime` `/convert/roman` `/convert/units` `/convert/base` `/convert/color`
- Tiempo: `/time/now` `/time/age` `/time/diff`
- Diversión: `/fun/ship` `/fun/dice` `/fun/8ball` `/fun/coin` `/generate/lorem`
- Imágenes (PNG/SVG): `/generate/qr` `/generate/logo` `/generate/avatar`
- Validación: `/validate/email` `/validate/phone` `/info/ip`
- Bot: `/bot/status` `/bot/commands`

```bash
curl "https://tu-panel/api/v1/text/fancy?text=Versova&style=boldscript" -H "X-API-Key: vsk_..."
# o con ?key=vsk_...
```

Reglas:

- Contraseñas con **scrypt** (mín. 8 caracteres); las cuentas antiguas de créditos siguen
  entrando y su hash se migra solo.
- Las keys (`vsk_…`) se guardan **hasheadas** (SHA-256): se muestran una sola vez al crearlas.
- Vigencia de **1 a 100 días** (también para el owner y al renovar). Caducadas o revocadas
  responden `401` con `EXPIRED_KEY` / `REVOKED_KEY`.
- Usuarios normales: hasta 5 keys activas y 60 peticiones/min por key (`429 RATE_LIMIT`).
  Owner: hasta 50 keys y sin límite por minuto.
- El owner se define con `OWNER_EMAIL` (por defecto `lyanvalentinmail@gmail.com`). Basta
  con registrarse con ese correo; si además defines `OWNER_PASSWORD`, la cuenta se crea
  sola al arrancar. Crear cupones de créditos ahora también requiere ser owner.

Puedes repetir el proceso hasta **3 sub-bots** con números distintos. Cada uno tiene su
carpeta de credenciales en `sessions/` (fuera de git) y su propio prefijo.

---

## 𓆩 ⛓️ 𓆪 Comandos (53)

Cada bot usa el **prefijo que elegiste al crearlo** (`#` `-` `+` `.` `/`, por defecto `.`)
· idioma español · `«prefijo»menu` muestra el menú oficial del team y `«prefijo»help`
explica todos los comandos (`«prefijo»help <sección>` detalla una sección). Referencia
completa en **[docs/COMANDOS.md](docs/COMANDOS.md)**.

| Sección | Comandos |
|---|---|
| **Vinculación opcional por comando** | `.pairing` (pairing code real) · `.key` / `.clave` (alias) — funcionan con cualquier prefijo: `#key` `+key`… |
| **Información** | `.menu` `.help` `.ping` `.botinfo` `.owner` |
| **Registro** | `.reg <nombre.edad>` `.unreg` `.editar <nombre.edad>` `.ficha` |
| **Personajes** | `.rol <personaje>` `.cambiarol <personaje>` `.roles` `.mirol` `.reservar <personaje>` `.reservas` `.liberarreserva` `.liberar` `.cancelarsolicitud` |
| **Gestión** | `.team` `.miembros` `.afk <motivo>` `.afks` `.inactivos` `.config [clave] [valor]` `.sync` |
| **Interacción** | `.perfil [@user]` `.pareja <@user>` `.aceptar` `.rechazar` `.terminar` `.ship <@a> <@b>` `.reglas` `.admins` |
| **Administración** | `.add` `.expulsar` `.ban` `.unban` `.bloqueados` `.resetrol` `.warn` `.unwarn` `.warns` `.acceptrol` `.denyrol` `.pendientes` `.anuncio` `.close` `.open` `.invite` `.auditoria` |
| **Confirmación** | `.confirmar` (`.si` `.sí` `.yes` `.y`) · `.cancelar` (`.no` `.cancel`) |

`.acceptrol` y `.denyrol` funcionan **respondiendo** al aviso, con el folio (`#12`) o con
el nombre del personaje.

---

## 𓆩 𓂃 𓆪 Estructura del proyecto

```
src/
├── index.js              arranque (bot + panel, flags --no-web / --web-only)
├── config/               entorno, identidad, alias y valores por defecto
├── core/                 adaptador Baileys, orquestador de sub-bots, router,
│                         contexto, eventos de grupo, sincronización, mantenimiento
├── db/                   conexión WAL (better-sqlite3 o node:sqlite), esquema SQL y repositorios
├── services/             reglas de negocio (registro, roles, team, social, moderación)
├── commands/             53 comandos organizados por categoría
├── security/             permisos, validación, rate-limit, confirmaciones
├── design/               tema, 71 plantillas y menú oficial
└── utils/                ids, tiempo, texto, hash, plataforma (Termux), LID, instancia única
web/                      panel: servidor Express, API REST, SSE, auth y frontend
tools/simulator.js        banco de pruebas de comandos en terminal (NO es el bot real)
scripts/                  doctor, base de datos, Termux (instalar/arrancar) y vinculación por terminal
tests/                    308 pruebas con node:test
docs/                     arquitectura, base de datos, comandos, limitaciones y Termux
```

La regla de diseño: **los servicios no saben que existe WhatsApp**. Devuelven
`{ ok, view, data, extra, actions }`; el adaptador los convierte en mensajes y efectos.
Por eso se puede probar todo sin vincular un número.

---

## 𓆩 ☾ 𓆪 Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Bot + panel web |
| `npm run bot` | Solo el bot (sin panel) |
| `npm run web` | Solo el panel web |
| `npm run vincular` | Vincula un sub-bot desde la terminal (pairing code o `-- --qr`) |
| `npm run termux` | Termux: bot + panel con wake lock y reinicio automático |
| `npm run termux:setup` | Termux: instala/actualiza Node.js, dependencias y `.env` |
| `npm test` | 308 pruebas (servicios, router, base de datos, API, Termux) |
| `npm run sim` | Simulador interactivo de comandos en terminal |
| `npm run sim -- --demo` | Demo guiada con 81 escenarios reales |
| `npm run doctor` | Diagnóstico: Node, dependencias, BD, carpetas, `.env`, conectividad |
| `npm run db:inspect` | Estado de la base de datos (`-- --group <id>`, `-- --json`) |
| `npm run db:reset` | Borra la base de datos (`-- --dry`, `-- --yes [--sessions]`) |

---

## 𓆩 ⏳ 𓆪 Probar sin WhatsApp

```bash
npm run sim -- --demo     # 81 escenarios: registro, roles, parejas, warns, bans…
npm run sim               # terminal interactiva: escribe comandos como en el grupo
```

El simulador usa la **misma base de datos, los mismos servicios y las mismas plantillas**
que el bot real; solo sustituye el adaptador de Baileys. Está claramente etiquetado como
herramienta de pruebas y jamás se hace pasar por una conexión real.

<a id="pruebas"></a>

---

## 𓆩 ✓ 𓆪 Pruebas

```bash
npm test
# tests 325 · pass 325 · fail 0
```

Cubren: registro y duplicados, aprobación por respuesta/folio/nombre, resolución atómica
(una solicitud no se ejecuta dos veces), reservas y su expiración, cambios de personaje,
parejas bidireccionales, AFK y su enfriamiento, inactivos, configuración por grupo,
warns con expulsión automática, expulsión/ban con confirmación, re-expulsión al reingresar,
cierre de grupo, aislamiento entre grupos, enmascarado de números en todas las salidas,
rate-limit, expiración de confirmaciones, robustez ante errores de envío, las 71 plantillas
de diseño la API web completa (auth, sub-bots, grupos, solicitudes, SSE, estáticos), las cuentas
web y API keys (tope de 100 días, caducidad, revocación, límite por minuto, owner), los
38 endpoints funcionales y el menú en lista interactiva (envío con nodo `<biz>` y
lectura de la fila elegida).
También se prueba el adaptador `messages.upsert`: comandos propios y de terceros,
chats privados, mensajes offline recientes, deduplicación, ecos del bot, mensajes
encapsulados y caché de metadatos. El socket se sustituye en las pruebas: no requieren
credenciales ni verifican una conexión real con WhatsApp.
Además: los dos motores SQLite (`better-sqlite3` y `node:sqlite`, `DB_DRIVER=node npm test`),
las identidades LID de WhatsApp (`@lid`), la detección de Termux, la vinculación por
terminal, los scripts de instalación/arranque y el candado de instancia única.

---

## 𓆩 禊 𓆪 Seguridad

1. Permisos comprobados **antes** de ejecutar cada comando.
2. Registros duplicados imposibles (clave primaria + comprobación).
3. Un personaje no puede pertenecer a dos usuarios (índice único + asignación condicional).
4. Solicitudes repetidas bloqueadas por índice parcial.
5. Toda entrada se valida y sanitiza (longitud, caracteres, rangos, jids).
6. Los errores se capturan por comando y por socket: el bot no se cae.
7. Nadie edita datos ajenos: las escrituras usan el jid del autor.
8. Confirmación obligatoria en `.unreg`, `.liberar`, `.terminar`, `.expulsar` y `.ban`.
9. Anti-spam: 6 comandos/10 s, enfriamientos por comando y bloqueo temporal de 30 s.
10. `sessions/`, `data/`, `logs/` y `.env` fuera de git, con permisos `0700`;
    la vinculación requiere confirmar el QR o código desde el teléfono con WhatsApp.
11. Los números de teléfono **nunca** aparecen completos en mensajes públicos (`52•••••••78`).
12. Al salir del grupo se libera personaje, se rompen parejas, se cancelan solicitudes y
    se limpia el AFK; si la persona vuelve, su ficha se restaura.

---

## 𓆩 ⚠ 𓆪 Limitaciones que debes conocer

- `.add` casi nunca funciona: WhatsApp respeta la privacidad del destino (código `403`).
  Usa `.invite` y comparte el enlace del grupo.
- Los botones interactivos ya no se renderizan: las confirmaciones son por texto.
- Un número no puede estar vinculado a dos sesiones a la vez → 3 sub-bots = 3 números.
- El pairing code caduca en ~60 segundos.
- Baileys es un cliente **no oficial**: existe riesgo de suspensión del número. Usa un
  número secundario y no hagas spam.
- Expulsar, cerrar el grupo o leer su enlace requiere que el bot sea admin del grupo.

Detalle completo, con los códigos de error reales y sus mitigaciones:
**[docs/LIMITACIONES.md](docs/LIMITACIONES.md)**.

---

## 𓆩 ☕ 𓆪 Documentación

| Documento | Contenido |
|---|---|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Arquitectura, tecnologías, estructura, base de datos, funcionamiento por sistema, limitaciones y orden de desarrollo |
| [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md) | Esquema campo por campo, índices, invariantes y copias de seguridad |
| [docs/COMANDOS.md](docs/COMANDOS.md) | Los 53 comandos con permisos, ejemplos, alias y límites |
| [docs/LIMITACIONES.md](docs/LIMITACIONES.md) | Lo que WhatsApp no permite y cómo lo resuelve el bot |
| [docs/TERMUX.md](docs/TERMUX.md) | Ejecutar el bot en Android con Termux: instalación, 24/7, actualización y problemas frecuentes |

---

## 𓆩 ☁ 𓆪 Despliegue en Render (Blueprint Gratis)

Puedes desplegar VÉRSOVA en **Render de forma gratuita** con un solo clic usando el archivo `render.yaml` incluido en el repositorio.

<div align="center">

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lyanvalentinmail-prog/Project)

</div>

### Pasos para desplegar

1. Haz clic en el botón **Deploy to Render** de arriba (o en [dashboard.render.com](https://dashboard.render.com) ve a **New +** → **Blueprint** y selecciona este repositorio).
2. Render leerá automáticamente la configuración de `render.yaml`:
   - **Servicio:** Web Service (`versova-bot`)
   - **Plan:** Free (gratuito)
   - **Runtime:** Node 22 (≥ 22.13)
   - **Health check:** `/api/health`
3. En la pantalla de creación del Blueprint, introduce tu número en `OWNER_NUMBERS` (formato internacional sin `+`, ej. `5215512345678`).
4. Haz clic en **Apply**. Render compilará e iniciará el bot y el panel web automáticamente.
5. Al terminar el despliegue, abre la URL asignada por Render (ej. `https://versova-bot.onrender.com`).
6. **Panel abierto:** el dashboard no pide contraseña. Cada bot queda listo al vincular
   WhatsApp desde el panel, sin clave de activación.
7. En el panel ve a **Registrar** (o **Mis Bots → Crear Bot**) y vincula tu número mediante **QR** o **Pairing Code**.

### ⚠ Consideraciones del plan gratuito de Render

- **Suspensión por inactividad (Spin-down):** Los servicios web en el plan gratuito de Render se suspenden tras 15 minutos sin tráfico HTTP entrante. Para mantener tu bot conectado **24/7 de forma gratuita**, configura un monitor de disponibilidad gratuito (como [UptimeRobot](https://uptimerobot.com) o [cron-job.org](https://cron-job.org)) que envíe una petición cada 10-12 minutos a:
  ```
  https://<tu-servicio>.onrender.com/api/health
  ```
  Render otorga 750 horas gratuitas por mes, suficiente para mantener un servicio activo 24/7 sin ningún costo.
- **Almacenamiento efímero en el plan free:** Render no permite discos persistentes (`disk:`) en el plan gratuito. La base de datos y sesiones se mantienen activas mientras el contenedor no se reinicie o redespliegue. Si deseas persistencia permanente con disco SSD dedicado en Render, actualiza al plan **Starter** ($7/mes) y añade la configuración de disco a `render.yaml`.

---

## 𓆩 𓂃 𓆪 Despliegue rápido (VPS)

```bash
git clone https://github.com/lyanvalentinmail-prog/Project.git versova
cd versova && npm install --omit=dev
cp .env.example .env      # OWNER_NUMBERS, WEB_PORT
npm run doctor            # verifica conectividad con WhatsApp
npm start                 # o con pm2: pm2 start src/index.js --name versova
```

Recomendado detrás de un proxy inverso con HTTPS (nginx/caddy). Copia de seguridad:
`data/versova.db` y `sessions/`. Si `better-sqlite3` no compila en tu servidor, la
instalación sigue igual y el bot usa el SQLite integrado en Node.

---

<div align="center">

𝖸𝗈𝗎𝗋 𝗋𝗈𝗅𝖾 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗂𝖽𝖾𝗇𝗍𝗂𝗍𝗒.
𝖸𝗈𝗎𝗋 𝗍𝖾𝖺𝗆 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗌𝗍𝗈𝗋𝗒.

⌞ ≪⁹⁹ ⁙ 𝐕𝐄́𝐑𝐒𝐎𝐕𝐀 · est. 2026

</div>
