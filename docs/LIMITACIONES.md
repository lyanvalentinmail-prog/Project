# 𓆩 ⛓️ 𓆪 VÉRSOVA — Limitaciones técnicas reales

Ninguna de estas limitaciones depende del código: son reglas de la plataforma WhatsApp.
VÉRSOVA las **detecta y explica** en lugar de fingir que funcionó.

---

## 1. `.add` casi nunca puede añadir a alguien a un grupo

**Qué pasa:** WhatsApp respeta la privacidad del destino. `groupParticipantsUpdate(jid, [persona], 'add')`
devuelve códigos reales que el bot traduce:

| Código | Significado | Qué responde VÉRSOVA |
|---|---|---|
| `200` | Añadido | Confirmación + recordatorio de `.reg` |
| `403` | La persona no admite que la añadan, o el grupo exige aprobación de admin | Explica el motivo y ofrece `.invite` |
| `408` | Salió hace poco y WhatsApp bloquea el reingreso temporal | Explica la espera |
| `409` | Ya estaba en el grupo | Lo informa |
| `500/501` | Error del servidor o función no disponible | Pide reintentar |

**Alternativa fiable:** `.invite` genera el enlace real del grupo (`https://chat.whatsapp.com/…`)
y es la vía que sí funciona siempre.

**Nunca se registra automáticamente** a la persona añadida: tiene que usar `.reg`.

---

## 2. Los botones y listas interactivas ya no se renderizan

Los `buttonsMessage` / `listMessage` dejaron de mostrarse en los clientes actuales de
WhatsApp para cuentas que no son Business API. Por eso las confirmaciones son **por texto**:

```
.unreg → ¿seguro? .confirmar / .cancelar
```

Funcionan en cualquier cliente y no dependen de funciones que WhatsApp pueda retirar.

---

## 3. El bot solo ve lo que ocurre mientras está vinculado

- No hay histórico anterior a la vinculación (VÉRSOVA no sincroniza el pasado: `syncFullHistory=false` a propósito, para no saturar).
- Al reconectar, WhatsApp puede entregar mensajes pendientes como `append`. Se
  procesan solo los de los últimos **2 minutos**; los antiguos o sin fecha válida se
  ignoran para no ejecutar órdenes viejas. La entrega depende de WhatsApp.
- Se deduplican los eventos repetidos durante 10 minutos (hasta 2000 IDs por bot,
  en memoria) y se resincronizan grupos, administradores y tamaños desde
  `groupFetchAllParticipating()`.
- La base de datos conserva todo lo anterior: **nada se pierde al reiniciar**.

---

## 4. Expulsar, añadir, cerrar el grupo o leer su enlace exige ser admin

Antes de actuar, el bot comprueba si su número aparece como `admin` en los participantes
del grupo. Si no lo es, responde:

> No soy administrador del grupo, así que no puedo ejecutar esta acción. Pídeme admin y vuelve a intentarlo.

Y no intenta la llamada (evita errores silenciosos y bans).

---

## 5. Un número = una sesión. Máximo 3 sub-bots

- WhatsApp limita los **dispositivos vinculados** por cuenta (4 como máximo, uno de ellos el teléfono).
- El mismo número **no puede** estar vinculado a dos sesiones a la vez: el panel lo rechaza
  antes de intentarlo (`ese número ya tiene un sub-bot`).
- VÉRSOVA fija el tope en **3 sub-bots** por estabilidad: cada sesión consume CPU/RAM y
  mantiene su propio socket. Con más de 3 el riesgo de desconexiones y de detección aumenta.

---

## 6. El pairing code caduca en ~60 segundos

`requestPairingCode(número)` devuelve 8 caracteres que deben escribirse en
**WhatsApp → Dispositivos vinculados → Vincular con el número de teléfono** dentro de un minuto.
El panel muestra el código formateado (`ABCD-1234`), permite **regenerarlo** y avisa si
WhatsApp no lo devolvió (por ejemplo, si el número ya está vinculado o no existe).

---

## 7. Riesgo de suspensión de la cuenta

Baileys implementa el protocolo Multi-Device **no oficial**. WhatsApp puede suspender el
número si detecta automatización. Mitigaciones incluidas en VÉRSOVA:

- Rate-limit por usuario (6 comandos/10 s) y enfriamientos por comando.
- Cola de envío serializada con 350 ms entre mensajes.
- Reconexión con backoff exponencial y tope de 60 s.
- Sin sincronización de histórico completo.

**Recomendación:** usa un número secundario dedicado al bot, no tu número personal.

---

## 8. No se pueden leer ni editar mensajes ajenos

No hay API para saber quién leyó un mensaje en grupos, editar mensajes de otros ni
recuperar mensajes eliminados. VÉRSOVA no ofrece ninguna función que dependa de eso.
Sí puede **responder citando** el mensaje del comando (lo usa para `.acceptrol` por respuesta).

---

## 9. Las menciones dependen de que el mensaje llegue

El aviso de AFK se dispara cuando el bot recibe un mensaje con `mentionedJid`. En grupos
muy activos WhatsApp puede no entregar todos los mensajes al instante, así que la detección
es **best-effort**. Para no spamear, cada persona AFK se anuncia como máximo una vez por minuto.

---

## 10. Límites de envío

Enviar decenas de mensajes seguidos provoca bloqueos temporales del número. VÉRSOVA:

- serializa los envíos por sub-bot,
- parte automáticamente los textos de más de 3800 caracteres,
- reintenta una sola vez ante errores 5xx/408 y registra el fallo si persiste.

Los anuncios con `@todos` mencionan como máximo a 100 registrados por mensaje.

---

## 11. El entorno de desarrollo no siempre tiene salida a WhatsApp

Verificado en este repositorio (sandbox sin ruta a los servidores de WhatsApp):

```
status      : closed
último error: 408 · WebSocket Error (Client network socket disconnected
              before secure TLS connection was established)
```

El panel muestra **ese error real** en vez de simular una conexión correcta. Para vincular
de verdad necesitas ejecutar el bot en una máquina con salida a `web.whatsapp.com:443`
(`npm run doctor` comprueba esa conectividad antes de arrancar).

---

## 12. Lo que sí está garantizado por diseño

| Riesgo | Cómo se evita |
|---|---|
| Dos fichas del mismo número | PK `(group_id, jid)` + comprobación previa |
| Dos personas con el mismo personaje | `UNIQUE(group_id, owner_jid)` + `assign()` condicional |
| Un usuario con dos personajes | Mismo índice único |
| Solicitudes duplicadas | `UNIQUE(group_id, user_jid, type) WHERE status='pending'` |
| Resolver dos veces la misma solicitud | `UPDATE … WHERE status='pending'` y comprobación de `changes` |
| Que un usuario edite datos ajenos | Los comandos de escritura usan siempre el jid del autor |
| Fugas de números de teléfono | Enmascarado en todo mensaje público (`52•••••••78`) |
| Que un error tumbe el bot | `try/catch` por comando, por mensaje y por socket + `uncaughtException` |
| Pérdida de datos al reiniciar | SQLite en WAL + transacciones + resincronización al conectar |
| Mezcla de datos entre grupos | Todas las consultas filtran por `group_id` |

Todo lo anterior está cubierto por la suite de pruebas: `npm test` (143 pruebas).
