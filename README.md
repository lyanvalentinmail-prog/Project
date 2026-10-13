<div align="center">

ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙
ㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪
ㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨
ㅤㅤ◢禍◣ Versova ࿙☕࿚

**Bot de WhatsApp para administración de teams de rol + panel web para gestionar hasta 3 sub-bots.**

`Registro · Personajes · Gestión · Interacción · Administración · Base de datos persistente`

[![Node](https://img.shields.io/badge/node-%E2%89%A522-8fbc72)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/baileys-7.0.0--rc14-c8a27a)](https://github.com/WhiskeySockets/Baileys)
[![tests](https://img.shields.io/badge/tests-154%20pass-8fbc72)](#pruebas)
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

- **Node.js 22 o superior** (`node -v`)
- Un **número de WhatsApp** por sub-bot (recomendado: números secundarios dedicados)
- Que ese número **te permita ser administrador** en los grupos donde quieras moderar
- npm (viene con Node)

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
𓆩 ☕ 𓆪  VÉRSOVA v1.0 · prefijos # - + . / (por sub-bot)
Base de datos  ⁙ data/versova.db
Comandos       ⁙ 53 registrados
Panel web      ⁙ http://localhost:3000
⚠ No hay sub-bots activados. Abre el panel web, crea uno y actívalo con la clave de .key.
```

---

## 𓆩 ♡ 𓆪 Crear, activar y vincular un bot

1. Abre el panel: **http://localhost:3000** (en un servidor remoto, el puerto 3000).
   **No hay contraseña**: el panel está abierto por diseño.
2. En **Registrar bot**: nombre, **prefijo de comandos** (`#` `-` `+` `.` `/`),
   número internacional sin `+` (ej. `5215512345678`) y método de vinculación.
   El bot se crea **desconectado**.
3. **Actívalo con `.key`**: pulsa *Conectar en WhatsApp*, envía `.key` desde WhatsApp
   al bot (o a cualquier bot conectado de la plataforma) y el bot te devolverá una
   clave de un solo uso (ej. `ABCD-2345`). Pégala en el panel → **Activar bot**.
4. **Vincula el número**: los QR y pairing codes son **reales** (los emite WhatsApp).
   - **QR** → se muestra en la ventana y se renueva solo; escanéalo en
     *WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo*.
   - **Pairing code** → aparece un código `ABCD-2345`; en el teléfono ve a
     *Dispositivos vinculados → Vincular un dispositivo → Vincular con el número de teléfono*
     y escríbelo (caduca en ~60 s; puedes regenerarlo).
5. Cuando el estado pase a **en línea**, añade el bot a tu grupo de rol y escribe
   `«prefijo»menu` (ej. `.menu` o `#menu` según el prefijo elegido).

Puedes repetir el proceso hasta **3 sub-bots** con números distintos. Cada uno tiene su
carpeta de credenciales en `sessions/` (fuera de git) y su propio prefijo.

---

## 𓆩 ⛓️ 𓆪 Comandos (53)

Cada bot usa el **prefijo que elegiste al crearlo** (`#` `-` `+` `.` `/`, por defecto `.`)
· idioma español · `«prefijo»menu` muestra el menú oficial del team y `«prefijo»help <sección>`
el detalle. Referencia completa en **[docs/COMANDOS.md](docs/COMANDOS.md)**.

| Sección | Comandos |
|---|---|
| **Activación** | `.key` (funciona con cualquier prefijo: `#key` `+key`…) |
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
├── db/                   conexión WAL, esquema SQL y repositorios
├── services/             reglas de negocio (registro, roles, team, social, moderación)
├── commands/             52 comandos organizados por categoría
├── security/             permisos, validación, rate-limit, confirmaciones
├── design/               tema, 71 plantillas y menú oficial
└── utils/                ids, tiempo, texto, hash
web/                      panel: servidor Express, API REST, SSE, auth y frontend
tools/simulator.js        banco de pruebas de comandos en terminal (NO es el bot real)
scripts/                  doctor, inspección y reinicio de la base de datos
tests/                    154 pruebas con node:test
docs/                     arquitectura, base de datos, comandos y limitaciones
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
| `npm test` | 154 pruebas (servicios, router, base de datos, API) |
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
# tests 154 · pass 154 · fail 0 · ~3 s
```

Cubren: registro y duplicados, aprobación por respuesta/folio/nombre, resolución atómica
(una solicitud no se ejecuta dos veces), reservas y su expiración, cambios de personaje,
parejas bidireccionales, AFK y su enfriamiento, inactivos, configuración por grupo,
warns con expulsión automática, expulsión/ban con confirmación, re-expulsión al reingresar,
cierre de grupo, aislamiento entre grupos, enmascarado de números en todas las salidas,
rate-limit, expiración de confirmaciones, robustez ante errores de envío, las 71 plantillas
de diseño y la API web completa (auth, sub-bots, grupos, solicitudes, SSE, estáticos).

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
    la activación de bots exige la clave de un solo uso que entrega `.key`.
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
| [docs/COMANDOS.md](docs/COMANDOS.md) | Los 52 comandos con permisos, ejemplos, alias y límites |
| [docs/LIMITACIONES.md](docs/LIMITACIONES.md) | Lo que WhatsApp no permite y cómo lo resuelve el bot |

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
   - **Runtime:** Node 22
   - **Health check:** `/api/health`
3. En la pantalla de creación del Blueprint, introduce tu número en `OWNER_NUMBERS` (formato internacional sin `+`, ej. `5215512345678`).
4. Haz clic en **Apply**. Render compilará e iniciará el bot y el panel web automáticamente.
5. Al terminar el despliegue, abre la URL asignada por Render (ej. `https://versova-bot.onrender.com`).
6. **Panel abierto:** el dashboard no pide contraseña. Cada bot se activa con la clave
   de un solo uso que genera el comando `.key` desde WhatsApp.
7. Inicia sesión en el panel, ve a **Sub-bots → Crear** y vincula tu número mediante **QR** o **Pairing Code**.

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
`data/versova.db` y `sessions/`.

---

<div align="center">

𝖸𝗈𝗎𝗋 𝗋𝗈𝗅𝖾 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗂𝖽𝖾𝗇𝗍𝗂𝗍𝗒.
𝖸𝗈𝗎𝗋 𝗍𝖾𝖺𝗆 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗌𝗍𝗈𝗋𝗒.

⌞ ≪⁹⁹ ⁙ 𝐕𝐄́𝐑𝐒𝐎𝐕𝐀 · est. 2026

</div>
