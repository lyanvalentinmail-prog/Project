# 𓆩 ☕ 𓆪 VÉRSOVA — Diseño de la base de datos

Motor: **SQLite** en modo **WAL**, con uno de estos dos controladores (misma API, ver `src/db/driver.js`):

| Controlador | Cuándo se usa |
|---|---|
| `better-sqlite3` | Si está instalado (dependencia **opcional**; PC, VPS, Render) |
| `node:sqlite` | SQLite integrado en Node ≥ 22.13: Termux/Android o si `better-sqlite3` no compiló |

`DB_DRIVER=auto` (por defecto) elige solo; `DB_DRIVER=node` o `DB_DRIVER=better-sqlite3` lo fuerzan.
`DB_JOURNAL_MODE` (por defecto `WAL`) cambia el diario; si el sistema de archivos no admite WAL,
la conexión pasa sola a `DELETE`. El panel (Métricas) y `npm run doctor` muestran el motor real.

Archivo: `data/versova.db` (fuera de git). Esquema v3. Mientras el bot corre existe
`data/versova.pid`: impide abrir una segunda copia con los mismos datos.

**Identidades LID.** WhatsApp identifica a muchos participantes con un jid `…@lid` en lugar
del número. El bot aprende la correspondencia LID → número (metadatos de grupo, contactos,
`lid-mapping.update` y la propia sesión) y guarda fichas, personajes, admins y warns **por
número** siempre que lo conoce; si no, conserva el `@lid` tal cual (nunca inventa un número).
Las filas antiguas guardadas con `@lid` no se migran: siguen funcionando con ese jid.

Reglas generales:

- **Todo está segmentado por `group_id`**: los datos de un grupo nunca se cruzan con los de otro.
- Las claves foráneas usan `ON DELETE CASCADE`: borrar un sub-bot elimina sus grupos y, con ellos, fichas, personajes, solicitudes y advertencias.
- Los invariantes críticos están reforzados por **índices únicos**, no solo por código: aunque dos procesos lo intenten a la vez, el motor lo impide.
- Fechas y marcas de tiempo: **enteros Unix en milisegundos** (`INTEGER`).
- Las transacciones (`tx()`) garantizan que una operación compleja se aplique entera o no se aplique.

---

## Diagrama

```
bot_instances 1───N groups 1───N users 1───0..1 roles
                        │           │
                        │           ├──N warnings
                        │           └──N requests (como solicitante o destino)
                        ├──N group_admins
                        ├──N group_blocked
                        ├──N requests
                        └──N audit_log

pending_confirmations (independiente, con expiración)
activation_keys (claves históricas de activación; ya no se necesitan)
command_stats + counters (estadísticas reales del panel)
web_tickets + web_users + plans + coupons (datos de la web, en la misma BD)
meta (versión de esquema, fecha de instalación)
```

---

## `meta`

| Campo | Tipo | Descripción |
|---|---|---|
| `key` | TEXT PK | `schema_version`, `installed_at` |
| `value` | TEXT | Valor |
| `updated_at` | INTEGER | Última actualización |

---

## `bot_instances` — sub-bots

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | Id corto aleatorio |
| `name` | TEXT | Nombre visible en el panel |
| `phone` | TEXT UNIQUE | Número internacional sin `+` (un número = un sub-bot) |
| `pairing_mode` | TEXT | `'qr'` o `'pairing'` |
| `prefix` | TEXT | Prefijo de comandos de ESTE bot: `#` `-` `+` `.` `/` (esquema v3) |
| `activated` | INTEGER | Indicador histórico; por defecto 1. Desde v4 no bloquea comandos y se habilitan las instancias antiguas. |
| `activated_at` | INTEGER | Cuándo se canjeó la clave de activación (v3) |
| `status` | TEXT | `created · starting · qr · pairing · connecting · open · closed · error · loggedOut` |
| `wa_jid` | TEXT | jid real asignado por WhatsApp tras vincular |
| `push_name` | TEXT | Nombre del perfil de WhatsApp |
| `session_dir` | TEXT | Carpeta de credenciales (`sessions/…`), fuera de git |
| `autostart` | INTEGER | 1 = arrancar con el proceso (solo si `activated = 1`) |
| `created_at` / `updated_at` / `last_connected_at` | INTEGER | Marcas de tiempo |
| `last_error` | TEXT | Último error real reportado (se muestra en el panel) |

---

## `groups`

| Campo | Tipo | Notas |
|---|---|---|
| `group_id` | TEXT PK | jid del grupo (`…@g.us`) |
| `instance_id` | TEXT FK | Sub-bot al que pertenece (CASCADE) |
| `name` | TEXT | Asunto actual del grupo |
| `wa_created_at` | INTEGER | Cuándo se creó el grupo en WhatsApp |
| `joined_at` | INTEGER | Cuándo entró el bot |
| `size` | INTEGER | Número de participantes |
| `config` | TEXT (JSON) | Configuración propia del grupo (abajo) |
| `welcome` / `farewell` | INTEGER | Bienvenida y despedida activas |
| `locked` | INTEGER | 1 = grupo cerrado (`.close`) |
| `last_sync_at` | INTEGER | Última sincronización con WhatsApp |

**Claves de `config`:** `prefix`, `inactivity_days`, `reserve_hours`, `max_warnings`,
`welcome`, `farewell`, `afk_mentions`, `commands_in_private`, `only_registered_roles`,
`couple_enabled`, `rules`. Se editan con `.config <clave> <valor>`.

---

## `group_admins` — espejo de los administradores de WhatsApp

| Campo | Tipo | Notas |
|---|---|---|
| `group_id` + `user_jid` | PK compuesta | |
| `is_super` | INTEGER | 1 = creador/superadmin del grupo |
| `synced_at` | INTEGER | Momento de la sincronización |

Se reescribe completo en cada sincronización (entrada al grupo, `promote`, `demote`, `.sync`, reconexión).

---

## `group_blocked` — lista negra

| Campo | Tipo | Notas |
|---|---|---|
| `group_id` + `user_jid` | PK compuesta | |
| `reason` | TEXT | Motivo del ban |
| `banned_by` | TEXT | jid del administrador responsable |
| `banned_at` | INTEGER | Fecha |

Al entrar alguien que está aquí, el bot lo vuelve a expulsar (si es admin del grupo).

---

## `roles` — personajes

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK | |
| `group_id` | TEXT FK | |
| `name` | TEXT | Nombre tal como se escribió (para mostrar) |
| `name_key` | TEXT | Clave canónica: minúsculas, sin acentos, espacios colapsados |
| `status` | TEXT | `free` · `taken` · `reserved` |
| `owner_jid` | TEXT | Quién lo interpreta |
| `taken_at` | INTEGER | Desde cuándo |
| `reserved_by` / `reserved_at` / `reserved_until` | TEXT/INTEGER | Reserva y su vencimiento |
| `released_at` | INTEGER | Última liberación |

**Índices que sostienen las reglas del brief:**

```sql
UNIQUE (group_id, name_key)                                     -- no hay dos personajes iguales
UNIQUE (group_id, owner_jid)     WHERE owner_jid   IS NOT NULL   -- un personaje por usuario
UNIQUE (group_id, reserved_by)   WHERE reserved_by IS NOT NULL   -- una reserva por usuario
```

Además, `roles.assign()` lleva la condición `status != 'taken' OR owner_jid = @jid`:
**nunca "roba" un personaje ya asignado** (devuelve `false` y la transacción se revierte).

---

## `users` — integrantes registrados

| Campo | Tipo | Notas |
|---|---|---|
| `group_id` + `jid` | **PK compuesta** | Impide registros duplicados por número |
| `phone` | TEXT | Dígitos del teléfono (uso interno; nunca se muestra completo) |
| `name` / `age` | TEXT / INTEGER | Validados al registrar y editar |
| `role_id` | INTEGER FK → `roles.id` (ON DELETE SET NULL) | Personaje actual |
| `registered_at` | INTEGER | Fecha de registro |
| `last_activity` | INTEGER | Última actividad (escritura limitada a 1/min) |
| `afk_reason` / `afk_since` | TEXT / INTEGER | Estado AFK |
| `partner_jid` | TEXT | Pareja (bidireccional por transacción) |
| `warn_count` | INTEGER | Recalculado desde `warnings` |
| `status` | TEXT | `active · left · kicked · banned` |
| `left_at` | INTEGER | Cuándo salió |
| `push_name` | TEXT | Nombre de WhatsApp (respaldo) |

Índices: `(group_id, last_activity)`, `(group_id, role_id)`, `(group_id, partner_jid)`.

---

## `requests` — solicitudes

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK | Folio visible (`#12`) |
| `group_id` | TEXT FK | |
| `user_jid` | TEXT | Quien la crea |
| `target_jid` | TEXT | Destino (solo en parejas) |
| `role_name` / `prev_role_name` | TEXT | Personaje pedido y el que se libera |
| `type` | TEXT | `role` · `role_change` · `couple` |
| `status` | TEXT | `pending · approved · rejected · cancelled · expired` |
| `wa_message_id` | TEXT UNIQUE | Id del mensaje del aviso → permite aprobar **respondiendo** |
| `reason` | TEXT | Motivo del rechazo |
| `created_at` / `resolved_at` / `resolved_by` | INTEGER/TEXT | Trazabilidad |

```sql
UNIQUE (group_id, user_jid, type) WHERE status = 'pending'   -- sin solicitudes duplicadas
UNIQUE (wa_message_id)            WHERE wa_message_id IS NOT NULL
```

La resolución es atómica:

```sql
UPDATE requests SET status=?, resolved_at=?, resolved_by=? WHERE id=? AND status='pending'
```

Si `changes !== 1`, otro administrador ya la resolvió y **no se ejecuta dos veces**.

---

## `warnings`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK | |
| `group_id` + `user_jid` | TEXT | A quién |
| `reason` | TEXT | Motivo |
| `admin_jid` | TEXT | Administrador responsable |
| `created_at` | INTEGER | Fecha |
| `revoked_at` / `revoked_by` | INTEGER/TEXT | `.unwarn` no borra: revoca (historial completo) |

`users.warn_count` se recalcula con `COUNT(*) … WHERE revoked_at IS NULL`.

---

## `pending_confirmations`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | |
| `group_id` + `user_jid` | TEXT | UNIQUE por usuario: una sola confirmación pendiente |
| `action` | TEXT | `unreg` · `liberar` · `terminar` · `moderate` |
| `payload` | TEXT (JSON) | Datos necesarios para ejecutar (p. ej. a quién expulsar) |
| `created_at` / `expires_at` | INTEGER | 60 s por defecto |

Sobreviven a un reinicio (están en disco) y se purgan cada minuto.

---

## `audit_log`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK | |
| `instance_id` / `group_id` | TEXT | Contexto |
| `actor_jid` | TEXT | Quién ejecutó |
| `action` | TEXT | `user.register`, `role.approved`, `mod.kick`, `group.close`, `security.denied`… |
| `target_jid` | TEXT | Sobre quién |
| `detail` | TEXT (JSON) | Datos extra |
| `created_at` | INTEGER | Cuándo |

Índices por `(group_id, created_at DESC)` y `created_at DESC`. Se purga lo anterior a 90 días.

---

## `activation_keys` — activación de bots (v3)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK | |
| `code` | TEXT UNIQUE | Cuerpo de 8 caracteres (alfabeto sin `0/O/1/I/L`), se muestra como `ABCD-2345` |
| `creator_jid` | TEXT | Quién envió `.key` desde WhatsApp |
| `creator_instance` | TEXT | Bot que generó la clave |
| `created_at` / `expires_at` | INTEGER | Caducan a los 10 min |
| `used_at` | INTEGER | Cuándo se canjeó en el panel |
| `used_by_instance` | TEXT | Sub-bot que quedó activado con ella |

Tabla histórica conservada por compatibilidad. Desde v4 no se generan ni se exigen
claves de activación. `POST /api/instances/:id/activate` acepta peticiones sin clave;
`.key` es un alias opcional de `.pairing`. La vinculación de WhatsApp sigue siendo necesaria.

---

## `command_stats` · `counters` — estadísticas reales (v3)

| Tabla | Campos | Uso |
|---|---|---|
| `command_stats` | `command` PK, `count`, `last_used_at` | Cuántas veces se ejecutó cada comando (Top comandos del panel) |
| `counters` | `name` PK, `value`, `updated_at` | Contadores sueltos: `messages`, `apiRequests` |

Lo que la web muestra en Métricas sale de aquí o de consultas reales: **nada de datos inventados**.

---

## `web_tickets` · `web_users` · `plans` · `coupons` — datos de la web (v2–v3)

| Tabla | Uso |
|---|---|
| `web_tickets` | Tickets del centro de soporte (asunto, mensaje, estado `Abierto/Respondido/Cerrado`) |
| `web_users` | Cuentas de la tienda (email, username, hash de contraseña, créditos, plan, API key) |
| `plans` | Planes de créditos mostrados en la tienda (precio, créditos, features en JSON) |
| `coupons` / `coupon_uses` / `credit_transactions` | Cupones y movimientos de créditos |

La web y los bots comparten la misma base de datos: lo que ves en el panel son filas reales.

---

## Persistencia y recuperación

- `PRAGMA journal_mode = WAL` → el panel web lee mientras el bot escribe.
- `PRAGMA synchronous = NORMAL` + `busy_timeout = 5000` → rendimiento y cero bloqueos.
- Al arrancar se aplican las migraciones pendientes (`MIGRATIONS` en `src/db/connection.js`).
- Al reconectar a WhatsApp, `resyncAllGroups()` vuelve a leer `groupFetchAllParticipating()` y
  refresca nombres, tamaños y administradores: **los datos no se pierden ni se desincronizan**.

## Copias de seguridad

```bash
sqlite3 data/versova.db ".backup 'respaldo-$(date +%F).db'"
```

O copia en frío del archivo (con el bot detenido). `npm run db:inspect -- --json` vuelca el estado en JSON.
