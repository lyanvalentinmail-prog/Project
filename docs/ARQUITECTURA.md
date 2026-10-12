# 𓆩 ☕ 𓆪 VÉRSOVA — Documento de Arquitectura v1.0

> **Team:** ◢禍◣ Versova ࿙☕࿚
> **Plataforma:** WhatsApp (grupos) + Panel Web de gestión
> **Idioma:** Español · **Prefijo:** `.` · **Estética:** dark / japonés / café

Este documento responde, en orden, a los 7 puntos solicitados antes de programar:
arquitectura, tecnologías, estructura, base de datos, funcionamiento por sistema,
limitaciones técnicas reales de WhatsApp y orden de desarrollo.

---

## 1. Arquitectura recomendada

VÉRSOVA usa una **arquitectura en capas con adaptador de transporte**. La regla de oro:
**la lógica de negocio no sabe que existe WhatsApp**. Los servicios devuelven resultados
estructurados (`{ ok, view, data }`) y una capa de diseño los convierte en texto decorado.
Eso permite probar todo el bot sin conectar un número real y cambiar de librería sin
reescribir comandos.

```
        ┌──────────────────────────── WhatsApp ────────────────────────────┐
        │  socket #1 (número A)   socket #2 (número B)   socket #3 (nº C)  │
        └───────────────┬──────────────────────────────────────────────────┘
                        │  Baileys (protocolo Multi-Device)
        ┌───────────────▼───────────────┐        ┌──────────────────────────┐
        │  CORE · BotClient (adaptador) │        │  WEB · Express + SSE     │
        │  connect / QR / pairing / re- │        │  panel de gestión        │
        │  connect / eventos de grupo   │        │  (hasta 3 sub-bots)      │
        └───────────────┬───────────────┘        └────────────┬─────────────┘
                        │                                     │
        ┌───────────────▼─────────────────────────────────────▼─────────────┐
        │                    BotManager (orquestador)                       │
        │  arranca/para instancias, estado en vivo, límites, reconexión     │
        └───────────────┬───────────────────────────────────────────────────┘
                        │ ctx (grupo, autor, permisos, reply, mentions)
        ┌───────────────▼───────────────┐
        │  ROUTER · dispatcher          │  prefijo → comando → validación
        │  rate-limit · permisos ·      │  confirmaciones · anti-duplicados
        │  auditoría                    │
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐      ┌────────────────────────────┐
        │  COMMANDS (40+ módulos)       │─────▶│  DESIGN (plantillas)       │
        │  registro · roles · team ·    │      │  25+ diseños distintos     │
        │  social · admin · info        │      │  menús, fichas, avisos     │
        └───────────────┬───────────────┘      └────────────────────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  SERVICES (reglas de negocio) │  transacciones, invariantes
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  REPOSITORIES (SQL)           │  consultas preparadas, sin SQL suelto
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  SQLite (WAL) · data/versova.db│  persistente entre reinicios
        └───────────────────────────────┘
```

**Decisiones clave**

| Decisión | Motivo |
|---|---|
| Baileys y no whatsapp-web.js | No requiere Chromium/Puppeteer (RAM ~80 MB vs ~600 MB), soporta **varios números en un mismo proceso** y expone **pairing code** de forma nativa, que es lo que pide el panel web. |
| SQLite (better-sqlite3) en WAL | Persistencia real sin servidor externo, lecturas/escrituras síncronas y rápidas, transacciones para invariantes (un personaje = un dueño). |
| Servicios + plantillas separados | Testeable sin WhatsApp; los mensajes decorados se cambian sin tocar la lógica. |
| Un proceso, N sockets | Los 3 sub-bots comparten base de datos y panel; cada uno tiene su carpeta de credenciales aislada. |
| SSE en el panel | QR, pairing code y logs en vivo sin WebSockets ni dependencias extra. |

---

## 2. Tecnologías necesarias

| Capa | Tecnología | Versión | Para qué |
|---|---|---|---|
| Runtime | Node.js | ≥ 22 | ESM nativo, `node:test`, estable |
| WhatsApp | `@whiskeysockets/baileys` | 7.0.0-rc14 | Protocolo MD, QR, pairing code, grupos |
| BD | `better-sqlite3` | 13.x | Persistencia, transacciones |
| Web | `express` | 5.x | API REST del panel |
| QR | `qrcode` | 1.5.x | PNG/DataURL del QR en el navegador |
| Config | `dotenv` | 18.x | `.env` |
| Logs | `pino` | 10.x | Logger requerido por Baileys + auditoría |
| Tests | `node:test` | nativo | 0 dependencias de test |
| Frontend | HTML + CSS + JS vanilla | — | Sin build step: estable y desplegable en cualquier lado |

Nada de TypeScript ni bundlers: menos puntos de fallo, arranque directo con `node`.

---

## 3. Estructura del proyecto

```
Project/
├── docs/
│   ├── ARQUITECTURA.md      ← este documento
│   ├── BASE_DE_DATOS.md     ← esquema campo por campo
│   ├── COMANDOS.md          ← los 40+ comandos con sintaxis y permisos
│   └── LIMITACIONES.md      ← qué NO puede hacer WhatsApp y por qué
├── src/
│   ├── index.js             ← punto de entrada (bot + web, flags --no-web/--web-only)
│   ├── config/
│   │   ├── env.js           ← carga y valida .env
│   │   └── identity.js      ← nombre, team, prefijo, versión, owner
│   ├── core/
│   │   ├── bot-manager.js   ← orquesta hasta 3 instancias
│   │   ├── bot-client.js    ← adaptador Baileys: conexión, QR, pairing, reconexión
│   │   ├── router.js        ← dispatcher de comandos + confirmaciones
│   │   ├── context.js       ← ctx (autor, grupo, reply, menciones, quoted)
│   │   ├── events.js        ← bienvenida, despedida, re-ban, AFK, actividad
│   │   └── logger.js        ← pino + log en archivo
│   ├── db/
│   │   ├── index.js         ← conexión, WAL, migraciones
│   │   ├── schema.sql       ← DDL completo
│   │   └── repositories/    ← users, roles, groups, requests, warnings,
│   │                          couples, audit, instances, confirmations
│   ├── services/            ← reglas de negocio puras (testeables)
│   │   ├── registration.service.js
│   │   ├── roles.service.js
│   │   ├── team.service.js
│   │   ├── social.service.js
│   │   └── moderation.service.js
│   ├── commands/
│   │   ├── index.js         ← registro automático de comandos
│   │   ├── info/  registro/  roles/  team/  social/  admin/
│   ├── security/
│   │   ├── permissions.js   ← owner > admin > miembro
│   │   ├── rate-limit.js    ← token bucket por usuario/grupo/comando
│   │   ├── validation.js    ← sanitiza y valida todo dato entrante
│   │   ├── confirm.js       ← confirmaciones con expiración
│   │   └── privacy.js       ← enmascara números de teléfono
│   ├── design/
│   │   ├── theme.js         ← símbolos, separadores, kaomojis, paletas
│   │   ├── templates.js     ← cada mensaje con diseño propio
│   │   └── menu.js          ← menú principal (tal cual lo definiste)
│   └── utils/               ← ids, tiempo, parser "Nombre.edad", menciones
├── web/
│   ├── server.js            ← Express: API + estáticos + SSE
│   ├── routes/              ← auth, instances, groups, requests, stats
│   ├── auth.js              ← sesión por token (cookie httpOnly) + hash sha256
│   └── public/              ← index.html · styles.css · app.js
├── tools/
│   └── simulator.js         ← SIMULADOR EXPLÍCITO de WhatsApp (no es el bot real):
│                              permite probar comandos en terminal sin número
├── scripts/                 ← doctor.js, db-inspect.js, db-reset.js
├── tests/                   ← tests unitarios y de integración de servicios
├── data/       (git-ignored)← versova.db
├── sessions/   (git-ignored)← credenciales por sub-bot (¡secretos!)
└── logs/       (git-ignored)
```

---

## 4. Diseño de la base de datos

**Todo está segmentado por `group_id`**: los datos de un grupo nunca se mezclan con los
de otro. Claves foráneas con `ON DELETE CASCADE` y transacciones para los invariantes.

```
bot_instances 1───N groups 1───N users 1───1 roles (owner_jid)
                        │          │
                        │          └──N warnings
                        ├──N requests (role | role_change | couple)
                        ├──N group_blocked (bans)
                        ├──N group_admins
                        └──N audit_log
```

| Tabla | Campos principales | Notas |
|---|---|---|
| `bot_instances` | id, name, phone, pairing_mode, status, session_dir, wa_jid, push_name, created_at, last_connected_at | Una fila por sub-bot (máx. 3) |
| `groups` | group_id (jid), instance_id, name, wa_created_at, joined_at, config(JSON), welcome, farewell, locked | `config` guarda prefijo, días de inactividad, horas de reserva, máx. warns |
| `group_admins` | group_id, user_jid, is_owner_wa, synced_at | Espejo de los admins reales de WhatsApp |
| `group_blocked` | group_id, user_jid, reason, banned_by, banned_at | Lista negra; re-expulsión automática al reingresar |
| `users` | group_id, jid, name, age, role_id, registered_at, last_activity, afk_reason, afk_since, partner_jid, warn_count, status, left_at | PK compuesta `(group_id, jid)` |
| `roles` | id, group_id, name, name_key, status(free/taken/reserved), owner_jid, taken_at, reserved_by, reserved_until, released_at | `UNIQUE(group_id, name_key)` + `UNIQUE(group_id, owner_jid)` parcial → **imposible duplicar personaje o dueño** a nivel de motor |
| `requests` | id, group_id, user_jid, target_jid, role_name, prev_role_name, type, status, wa_message_id, reason, created_at, resolved_at, resolved_by | `wa_message_id` permite aprobar **respondiendo** al mensaje |
| `warnings` | id, group_id, user_jid, reason, admin_jid, created_at, revoked_at | Historial completo (no solo el contador) |
| `pending_confirmations` | id, group_id, user_jid, action, payload(JSON), expires_at | Sobreviven reinicios; expiran solas |
| `audit_log` | id, instance_id, group_id, actor_jid, action, target_jid, detail(JSON), created_at | Registro de eventos administrativos |
| `couples` | vista materializada sobre `users.partner_jid` | Bidireccional, garantizado por transacción |

Índices críticos: `roles(group_id, name_key)`, `users(group_id, last_activity)`,
`requests(group_id, status)`, `requests(wa_message_id)`, `group_blocked(group_id, user_jid)`.

Detalle completo campo por campo en [`docs/BASE_DE_DATOS.md`](BASE_DE_DATOS.md).

---

## 5. Funcionamiento de cada sistema

### 5.1 Registro (`.reg`, `.unreg`, `.editar`, `.ficha`)
- `.reg Moon.17` → el parser separa en el **último punto**: nombre `Moon`, edad `17`.
  Se valida: nombre no vacío (1–24 caracteres, sin saltos de línea), edad numérica 5–99,
  y que el `jid` no exista ya en ese grupo (anti-duplicado por PK).
- Se guarda nombre, edad, número, fecha de registro y personaje `NULL`.
- `.unreg` no borra a la primera: crea una **confirmación pendiente** (60 s). Con
  `.confirmar` se ejecuta en una transacción: borra registro → libera personaje →
  cancela reservas y solicitudes → rompe pareja → limpia AFK → actualiza `.miembros`.
- `.editar` modifica solo nombre y edad; el personaje **no se toca**.
- Sin registro, `.rol`, `.perfil`, `.pareja`, `.reservar` y `.ship` responden
  "registro rechazado" y no crean nada.

### 5.2 Roles / personajes
- `.rol Felix` → ① registrado ② personaje libre (ni tomado ni reservado por otro)
  ③ sin solicitud pendiente duplicada ④ crea `requests(type='role', status='pending')`
  ⑤ notifica a los admins del grupo con el id de solicitud y el `wa_message_id`.
- `.acceptrol` / `.denyrol` funcionan de dos formas: **respondiendo** al mensaje de la
  solicitud (se resuelve por `wa_message_id`) o con el id/nombre
  (`.acceptrol 12` / `.acceptrol Felix`). Resolver es atómico: `UPDATE ... WHERE
  status='pending'` y se comprueba `changes===1` → **nunca se ejecuta dos veces**.
- Al aprobar: se libera el personaje anterior (si era cambio), se marca `taken`,
  se asigna `users.role_id`, se notifica al integrante y se audita.
- `.reservar X` → 24 h (configurable). Un temporizador cada 60 s libera las reservas
  vencidas; `.reservas` y `.roles` muestran el tiempo restante formateado.
- `.liberar` pide confirmación y devuelve el personaje al pool.

### 5.3 Gestión del team
- `.team` agrega en una sola consulta: nombre, fecha de creación, integrantes del grupo,
  registrados, personajes ocupados y administradores.
- `.afk <motivo>` guarda motivo + inicio. Al **mencionar** a alguien AFK el bot avisa
  (con enfriamiento de 60 s por objetivo para no spamear). Si el usuario AFK manda
  cualquier mensaje no-comando, su estado se borra y se anuncia su regreso.
- `users.last_activity` se actualiza con cada mensaje (escritura limitada a 1/min por
  usuario para no castigar el disco). `.inactivos` ordena de mayor a menor días y usa
  el umbral de `groups.config.inactivity_days`, editable con `.config inactividad 10`.

### 5.4 Interacción social
- `.perfil @user` muestra nombre, edad, personaje, fecha de registro, pareja y AFK.
  El número aparece **enmascarado** (`52•••••••78`) por privacidad.
- `.pareja @user` → ambos registrados, ninguno con pareja, ninguna propuesta activa
  entre ellos → `requests(type='couple')` + mensaje decorado de propuesta.
  `.aceptar` escribe los dos `partner_jid` en la misma transacción (bidireccional
  garantizado); `.rechazar` cierra la solicitud; `.terminar` limpia ambos lados.
- `.ship @a @b` calcula un porcentaje **determinista** con hash de los dos jids
  (mismo resultado siempre, evita rerolls por spam) + frase según el rango. No escribe nada.

### 5.5 Administración
- Cada comando admin pasa por `permissions.assertAdmin(ctx)` **antes** de ejecutarse.
- `.warn` guarda motivo, admin responsable y fecha; `warn_count` se recalcula desde la
  tabla `warnings` (fuente de verdad). Al llegar a 3 → expulsión automática si el bot es
  admin, con auditoría. `.unwarn` revoca la más reciente.
- `.ban` = expulsar + insertar en `group_blocked`. El evento `group-participants.update`
  con `action='add'` comprueba la lista negra y re-expulsa.
- `.close` / `.open` → `groupSettingUpdate('announcement' | 'not_announcement')`.
- `.add` intenta `groupParticipantsUpdate(..., 'add')` y **reporta el código real** que
  devuelve WhatsApp (ver limitaciones: casi siempre falla por privacidad del destino).
- Jerarquía: el owner del bot > admins del grupo > miembros. Un admin no puede
  expulsar/banear/advertir a otro admin ni al owner.

### 5.6 Seguridad (las 12 medidas)
1. Permisos verificados antes de ejecutar (decorador en el router).
2. Anti-duplicados por PK y por `UNIQUE` en SQL, no solo en JS.
3. Un personaje = un dueño: índice único + transacción.
4. Solicitudes repetidas bloqueadas por `(group_id, user_jid, type, status='pending')`.
5. Validación de todo input: longitud, caracteres, rangos, jids.
6. `try/catch` global por comando y por socket: un error nunca tumba el proceso.
7. Nadie modifica datos ajenos: los comandos de escritura usan `ctx.author.jid`, no parámetros.
8. Confirmaciones para `.unreg`, `.liberar`, `.expulsar`, `.ban`, `.terminar`.
9. Rate-limit: 6 comandos/10 s por usuario y cooldown por comando; bloqueo temporal de 30 s.
10. `sessions/` y `.env` fuera de git (`.gitignore`), permisos 0700, contraseñas hasheadas.
11. Números enmascarados en cualquier mensaje público.
12. Al salir del grupo: `status='left'`, personaje libre, reservas y solicitudes canceladas,
    pareja rota, AFK limpio. Si vuelve, se reactiva su ficha.

### 5.7 Panel web
- Login con contraseña (hash SHA-256 + cookie `httpOnly` + `SameSite=Strict`).
- Crear hasta **3 sub-bots**, cada uno con su número y su modo de vinculación:
  **QR** (se renderiza en vivo y se regenera cada ~20 s) o **pairing code** (código de 8
  caracteres para introducir en WhatsApp → Dispositivos vinculados → Vincular con código).
- Estado en tiempo real por **SSE**: `qr`, `pairing`, `connecting`, `open`, `close`, logs.
- Gestión: ver grupos, miembros, personajes, solicitudes pendientes y **aprobarlas o
  rechazarlas desde la web** (misma capa de servicios que el bot, sin duplicar lógica).
- Reiniciar/desvincular/borrar instancia (borra también sus credenciales).

---

## 6. Limitaciones técnicas reales de WhatsApp

Esto es lo que **no** depende del código. Está implementado con el comportamiento honesto
que permite la plataforma (nada está simulado):

| # | Limitación | Qué hace VÉRSOVA |
|---|---|---|
| 1 | **`.add` no puede meter a cualquiera a un grupo.** WhatsApp respeta la privacidad del destino: si la persona no admite invitaciones de desconocidos, el servidor devuelve `403`/`409`. Solo funciona si el objetivo permite ser añadido por miembros del grupo. | Intenta `groupParticipantsUpdate('add')`, traduce el código de error a un mensaje claro y ofrece `.invite` (enlace de invitación real del grupo) como alternativa fiable. |
| 2 | **Botones interactivos y listas ya no se renderizan** en clientes modernos de WhatsApp para cuentas no-Business. | Las confirmaciones son **por texto** (`.confirmar` / `.cancelar`), no por botones. Funcionan en todos los clientes. |
| 3 | **El bot solo ve lo que ocurre mientras está vinculado.** No hay historial previo ni eventos perdidos durante una caída. | Reconexión automática con backoff; al reconectar re-sincroniza admins y miembros desde `groupMetadata`. |
| 4 | **Expulsar/añadir requiere que el número del bot sea admin** del grupo y que el grupo no limite esas acciones a "solo admins con permiso". | Se comprueba `participants[jid].admin` antes de actuar y se avisa si falta el permiso. |
| 5 | **Un mismo número no puede estar vinculado a dos sesiones a la vez** y WhatsApp limita los dispositivos vinculados (máx. 4 teléfonos/compañeros). | 3 sub-bots = **3 números distintos**. El panel lo valida antes de intentar vincular. |
| 6 | **El pairing code exige que el número no esté ya vinculado** y que se escriba en los primeros ~60 s. | El panel muestra el código con cuenta atrás y permite regenerarlo. |
| 7 | **Riesgo de baneo de cuenta.** Baileys es un cliente no oficial: WhatsApp puede suspender el número. | Recomendado: número secundario dedicado, tráfico moderado (rate-limit integrado) y sin spam. Documentado en el README. |
| 8 | **No se puede leer ni editar mensajes ajenos**, ni saber quién leyó qué en grupos grandes. | No se ofrece ninguna función que dependa de eso. |
| 9 | **Mencionar a alguien solo funciona si el bot recibe el mensaje.** En grupos con muchos mensajes WhatsApp puede no entregar todo al instante. | Detección de AFK por menciones con enfriamiento; no se promete detección del 100 %. |
| 10 | **Los límites de envío** (~decenas de mensajes seguidos) provocan bloqueos temporales. | Cola de envío con espera entre mensajes y reintentos con backoff. |
| 11 | **El sandbox de desarrollo no tiene salida a los servidores de WhatsApp.** | Por eso existe `npm run sim` (simulador **explícitamente etiquetado**) y la suite de tests: validan la lógica real sin red. El despliegue real se hace en tu máquina/servidor. |

---

## 7. Orden recomendado de desarrollo

| Fase | Contenido | Estado |
|---|---|---|
| **0** | Esqueleto, `.env`, config, logger, estructura de carpetas | ✅ |
| **1** | Base de datos: esquema, migraciones, repositorios | ✅ |
| **2** | Capa de diseño: tema, plantillas, menú | ✅ |
| **3** | Seguridad: permisos, validación, rate-limit, confirmaciones, privacidad | ✅ |
| **4** | Servicios de negocio: registro, roles, team, social, moderación | ✅ |
| **5** | Comandos (40+) conectados a servicios + router | ✅ |
| **6** | Eventos de grupo: bienvenida, despedida, re-ban, AFK, actividad, reservas | ✅ |
| **7** | Adaptador Baileys: conexión, QR, pairing, reconexión, cola de envío | ✅ |
| **8** | BotManager multi-instancia (3 sub-bots) | ✅ |
| **9** | Panel web: auth, API, SSE, frontend dark aesthetic | ✅ |
| **10** | Tests (servicios + router + integraciones) y `doctor.js` | ✅ |
| **11** | Vinculación real de tu número y pruebas en un grupo real | ⏳ requiere tu número |
| **12** | Endurecimiento: backups de la BD, métricas, comandos extra | 🔜 |

**Siguiente paso que depende de ti:** `cp .env.example .env`, pon tu número en
`OWNER_NUMBERS`, ejecuta `npm start`, abre el panel, crea tu sub-bot y vincula con QR o
pairing code. A partir de ahí el bot ya vive en tus grupos.
