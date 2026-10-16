# 𓆩 ☕ 𓆪 VÉRSOVA — Referencia de comandos

**Prefijo:** `.` (cambiable por grupo con `.config prefijo !`)
**Idioma:** español · **Versión:** 1.0 · **Team:** ◢禍◣ Versova ࿙☕࿚

Esta tabla se genera desde el registro real de comandos (`src/commands/`), así que
no puede desincronizarse del código.

## Rangos

| Rango | Quién es | Qué puede |
|---|---|---|
| **owner del bot** | Números en `OWNER_NUMBERS` del `.env` | Todo, en cualquier grupo. No puede ser expulsado, baneado ni advertido. |
| **admin / staff** | Administradores reales de WhatsApp o números añadidos en **Mis Bots → Editar → Números de admins** | Moderación, aprobación de personajes, configuración, anuncios, cerrar/abrir. El staff configurado en el panel solo tiene acceso en ese sub-bot, sin rango de owner. |
| **registrado** | Quien hizo `.reg <nombre.edad>` | Personajes, reservas, parejas, AFK, perfiles. |
| **miembro** | Cualquier persona del grupo | Comandos informativos (`.menu`, `.team`, `.roles`, `.reglas`, `.ship`…). |

Un admin **no** puede advertir, expulsar ni banear a otro admin ni al owner. Nadie puede
moderarse a sí mismo ni al bot. La lista del panel no asciende a nadie en WhatsApp: el
bot aún necesita ser admin real para realizar acciones de grupo. Los cambios de staff
se aplican al siguiente mensaje; borrar el número revoca solo el permiso del panel.

## Confirmaciones

Las acciones destructivas no se ejecutan a la primera:

```
.unreg            →  aviso con lo que se va a borrar
.confirmar        →  se ejecuta (o .cancelar para abortar)
```

Caducan a los **60 segundos**. También piden confirmación: `.liberar`, `.terminar`,
`.expulsar` y `.ban`.

## Respuesta a mensajes

`.acceptrol` y `.denyrol` funcionan de tres formas:

1. **Respondiendo** al mensaje de aviso que el bot envió a los admins.
2. Con el folio: `.acceptrol #12` / `.denyrol #12 motivo`.
3. Con el nombre del personaje: `.acceptrol Felix`.

## Flujos completos

**Alta de un integrante**
```
.reg Moon.17          → ficha creada
.rol Felix            → solicitud pendiente + aviso al staff
.acceptrol #1         → personaje asignado (o .denyrol #1 motivo)
.ficha                → ya aparece con su personaje
```

**Cambio de personaje**
```
.cambiarol Nagi       → solicitud de cambio
.acceptrol Nagi       → libera el anterior y asigna el nuevo
                      → si se rechaza, conservas el que tenías
```

**Reserva**
```
.reservar Bachira     → 24 h (configurable con .config reserva 48)
.reservas             → tiempo restante de todas
.liberarreserva       → cancelar la tuya antes de tiempo
```

**Parejas**
```
.pareja @persona      → propuesta (ambos registrados, ninguno con pareja)
.aceptar / .rechazar  → la responde quien recibió la propuesta
.terminar + .confirmar→ rompe la relación en ambos perfiles
.ship @a @b           → compatibilidad (no modifica nada)
```

**Moderación**
```
.warn @persona motivo → 1ª, 2ª… al llegar a 3 (.config warns N) expulsión automática
.unwarn @persona      → retira la más reciente
.expulsar @persona motivo + .confirmar
.ban @persona motivo  + .confirmar  → lista negra; si vuelve, se le expulsa solo
.unban <número>       → sale de la lista negra
.close / .open        → solo admins pueden escribir / todos
```

## 𓆩 🔑 𓆪 ⓪ VINCULACIÓN OPCIONAL (funciona con cualquier prefijo)

| Comando | Permiso | Qué hace |
|---|---|---|
| `.key` / `.clave` | todos | Alias de `.pairing`: consulta el código real de vinculación. Ya no genera una clave de activación. El código también se obtiene directamente desde el panel, sin comandos. |
| `.pairing` | todos | Solo el pairing code real (`ABCD-1234`) del sub-bot que está en vinculación, con su cuenta atrás. Si no hay ninguno, lo explica y no inventa códigos.<br />Ejemplo: `.pairing`<br />Alias: `.codigo` `.código` `.pairingcode` `.vincular` |

> Los códigos salen de WhatsApp (Baileys) y caducan a los ~60 s: pide otro con `.pairing`
> o pulsa *Pedir pairing code* en el panel. El bot **nunca** muestra un código falso.

## 𓆩 ☕ 𓆪 ① INFORMACIÓN Y SISTEMA

| Comando | Permiso | Qué hace |
|---|---|---|
| `.menu` | todos | Muestra el menú oficial de comandos de VÉRSOVA.<br />Ejemplo: `.menu`<br />Alias: `.ayuda` `.comandos` `.start` `.menucompleto` |
| `.help` `[sección | comando]` | todos | Ayuda detallada por sección o por comando.<br />Ejemplo: `.help roles` |
| `.ping` | todos | Latencia del bot y resumen de actividad.<br />Ejemplo: `.ping` |
| `.botinfo` | todos | Información técnica del bot: versión, grupos, fichas y sub-bots activos.<br />Ejemplo: `.botinfo` |
| `.owner` | todos | Muestra al owner del bot (número enmascarado).<br />Ejemplo: `.owner` |

## 𓆩 ✎ 𓆪 ② REGISTRO

| Comando | Permiso | Qué hace |
|---|---|---|
| `.reg` `<nombre.edad>` | todos | Registra tu ficha en el team usando tu número como identificador.<br />Ejemplo: `.reg Moon.17`<br />Alias: `.registrar` `.registrarme`<br />⚠ No puedes elegir personaje sin registrarte antes. |
| `.unreg` | registrados · **pide confirmación** | Elimina tu registro, libera tu personaje y cancela tus reservas.<br />Ejemplo: `.unreg`<br />Alias: `.delreg` `.borrar`<br />⚠ Pide confirmación: responde con .confirmar dentro de 60 segundos. |
| `.editar` `<nombre.edad>` | registrados | Modifica tu nombre y tu edad. Tu personaje no se toca.<br />Ejemplo: `.editar Luna.18`<br />Alias: `.edit` |
| `.ficha` | registrados | Muestra tu información personal: nombre, edad, personaje, registro, estado y warns.<br />Ejemplo: `.ficha`<br />Alias: `.miperfil` `.info` |

## 𓆩 🥢 𓆪 ③ PERSONAJES (ROLES)

| Comando | Permiso | Qué hace |
|---|---|---|
| `.rol` `<personaje>` | registrados | Solicita un personaje. Un admin debe aprobarlo.<br />Ejemplo: `.rol Felix`<br />Alias: `.role` `.pedirrol`<br />⚠ Un personaje no puede pertenecer a dos personas a la vez. |
| `.cambiarol` `<personaje>` | registrados | Pide cambiar tu personaje actual por otro. Requiere aprobación.<br />Ejemplo: `.cambiarol Nagi`<br />Alias: `.cambiarpersonaje`<br />⚠ Si se rechaza, conservas tu personaje anterior. |
| `.roles` | todos | Muestra los personajes ocupados y quién los interpreta.<br />Ejemplo: `.roles`<br />Alias: `.rolesocupados` `.listarol` |
| `.mirol` | registrados | Muestra tu personaje actual y tus reservas activas.<br />Ejemplo: `.mirol`<br />Alias: `.myrol` |
| `.reservar` `<personaje>` | registrados | Reserva un personaje libre durante 24 horas (configurable).<br />Ejemplo: `.reservar Bachira`<br />Alias: `.reserve`<br />⚠ No se puede reservar un personaje ocupado ni tener dos reservas. |
| `.reservas` | todos | Lista las reservas activas del grupo con su tiempo restante.<br />Ejemplo: `.reservas` |
| `.liberarreserva` | registrados | Cancela tu reserva activa antes de que venza.<br />Ejemplo: `.liberarreserva` |
| `.liberar` | registrados · **pide confirmación** | Libera tu propio personaje y lo deja disponible para el team.<br />Ejemplo: `.liberar`<br />Alias: `.soltarrol`<br />⚠ Pide confirmación con .confirmar. |
| `.cancelarsolicitud` | registrados | Retira tu solicitud de personaje pendiente.<br />Ejemplo: `.cancelarsolicitud` |
| `.pendientes` | admins | Lista todas las solicitudes pendientes del grupo.<br />Ejemplo: `.pendientes` |

## 𓆩 𖤐 𓆪 ④ GESTIÓN DEL TEAM

| Comando | Permiso | Qué hace |
|---|---|---|
| `.team` | todos | Información general del team: integrantes, registrados, personajes y admins.<br />Ejemplo: `.team`<br />Alias: `.equipo` `.groupinfo` `.teaminfo` |
| `.miembros` | todos | Lista de integrantes registrados con su personaje.<br />Ejemplo: `.miembros`<br />Alias: `.members` `.lista` |
| `.afk` `<motivo>` | registrados | Activa tu estado AFK. Al escribir cualquier mensaje sales del AFK.<br />Ejemplo: `.afk Estoy estudiando`<br />Alias: `.ausente` |
| `.afks` | todos | Lista quién está AFK ahora mismo y por qué.<br />Ejemplo: `.afks` |
| `.inactivos` | registrados | Muestra quién lleva tiempo sin escribir, ordenado de mayor a menor inactividad.<br />Ejemplo: `.inactivos`<br />Alias: `.inactivo` `.ausencias`<br />⚠ El umbral se configura con .config inactividad <días>. |
| `.config` `[clave] [valor]` | todos | Consulta (todos) o ajusta (admins) la configuración del grupo.<br />Ejemplo: `.config inactividad 10`<br />⚠ Claves: inactividad, reserva, warns, prefijo, bienvenida, despedida, afk, parejas. |
| `.auditoria` | admins | Últimos eventos administrativos del grupo.<br />Ejemplo: `.auditoria` |
| `.sync` | admins | Fuerza la sincronización de admins y miembros desde WhatsApp.<br />Ejemplo: `.sync` |

## 𓆩 ♡ 𓆪 ⑤ INTERACCIÓN SOCIAL

| Comando | Permiso | Qué hace |
|---|---|---|
| `.perfil` `[@usuario]` | todos | Muestra tu perfil o el de otro integrante (número enmascarado).<br />Ejemplo: `.perfil @usuario`<br />Alias: `.profile` |
| `.pareja` `<@usuario>` | registrados | Envía una propuesta de pareja. La otra persona debe aceptarla.<br />Ejemplo: `.pareja @usuario`<br />Alias: `.parejacon` `.proponer`<br />⚠ Ambos deben estar registrados y ninguno puede tener pareja. |
| `.aceptar` | registrados | Acepta la propuesta de pareja que tienes pendiente.<br />Ejemplo: `.aceptar` |
| `.rechazar` | registrados | Rechaza la propuesta de pareja que tienes pendiente.<br />Ejemplo: `.rechazar` |
| `.terminar` | registrados · **pide confirmación** | Termina tu relación actual y actualiza ambos perfiles.<br />Ejemplo: `.terminar`<br />⚠ Pide confirmación con .confirmar. |
| `.ship` `<@usuario> [@usuario2]` | todos | Calcula la compatibilidad entre dos personas. No modifica parejas.<br />Ejemplo: `.ship @persona1 @persona2`<br />Alias: `.shipeo` `.compatibilidad`<br />⚠ Con una sola mención, te shipea contigo. |
| `.reglas` | todos | Muestra las reglas del team.<br />Ejemplo: `.reglas`<br />Alias: `.rules` `.normas` |
| `.admins` | todos | Muestra los administradores del grupo.<br />Ejemplo: `.admins`<br />Alias: `.admines` `.staff` |

## 𓆩 ⛓️ 𓆪 ⑥ ADMINISTRACIÓN (solo staff)

| Comando | Permiso | Qué hace |
|---|---|---|
| `.acceptrol` `[#id | personaje]` | admins | Aprueba una solicitud de personaje (responde al aviso o indica el folio).<br />Ejemplo: `.acceptrol #12`<br />Alias: `.aprobarrol` `.aprobar`<br />⚠ También funciona respondiendo al mensaje del aviso de solicitud. |
| `.denyrol` `[#id | personaje] [motivo]` | admins | Rechaza una solicitud de personaje. No modifica el personaje anterior.<br />Ejemplo: `.denyrol #12 Ese personaje es para otro team`<br />Alias: `.rechazarrol` `.denegar` |
| `.resetrol` `<@usuario>` | admins | Libera el personaje de otro integrante sin borrar su registro.<br />Ejemplo: `.resetrol @usuario` |
| `.add` `<@usuario | número>` | admins | Intenta añadir a alguien al grupo. No lo registra automáticamente.<br />Ejemplo: `.add 5215512345678`<br />⚠ WhatsApp puede impedírselo según la privacidad del destino; el bot informa el motivo real. |
| `.expulsar` `<@usuario> [motivo]` | admins · **pide confirmación** | Expulsa a un integrante del grupo tras confirmar.<br />Ejemplo: `.expulsar @usuario Spam en el rol`<br />Alias: `.kick` |
| `.ban` `<@usuario> [motivo]` | admins · **pide confirmación** | Expulsa y añade a la lista negra. Si vuelve a entrar, se le expulsa otra vez.<br />Ejemplo: `.ban @usuario Raid` |
| `.unban` `<@usuario | número>` | admins | Saca a alguien de la lista de bloqueados.<br />Ejemplo: `.unban 5215512345678` |
| `.bloqueados` | admins | Muestra la lista negra del grupo.<br />Ejemplo: `.bloqueados` |
| `.warn` `<@usuario> <motivo>` | admins | Añade una advertencia. Con 3 (configurable) se expulsa automáticamente.<br />Ejemplo: `.warn @usuario Spam`<br />Alias: `.advertir` |
| `.unwarn` `<@usuario>` | admins | Retira la advertencia más reciente de un integrante.<br />Ejemplo: `.unwarn @usuario`<br />Alias: `.quitarwarn` |
| `.warns` `<@usuario>` | admins | Historial de advertencias de un integrante.<br />Ejemplo: `.warns @usuario` |
| `.anuncio` `<mensaje>` | admins | Publica un anuncio con formato decorado. Usa "@todos" al inicio para mencionar.<br />Ejemplo: `.anuncio @todos Hoy hay evento de rol a las 21:00`<br />Alias: `.announce` |
| `.close` | admins | Cierra el grupo: solo los administradores pueden escribir.<br />Ejemplo: `.close`<br />Alias: `.cerrar` |
| `.open` | admins | Abre el grupo: todos pueden escribir de nuevo.<br />Ejemplo: `.open`<br />Alias: `.abrir` |
| `.invite` | admins | Genera el enlace de invitación del grupo (la vía fiable para añadir gente).<br />Ejemplo: `.invite` |

## 𓆩 禊 𓆪 COMANDOS DE CONFIRMACIÓN

| Comando | Qué hace |
|---|---|
| `.confirmar` | Confirma la acción pendiente (.unreg, .liberar, .expulsar, .ban, .terminar). |
| `.cancelar` | Cancela la acción pendiente. |

> Alias equivalentes: `.si` `.sí` `.yes` `.y` = `.confirmar` · `.no` `.cancel` = `.cancelar`.

---

## Límites de uso

| Regla | Valor por defecto | Dónde se cambia |
|---|---|---|
| Comandos por ventana | 6 cada 10 s por usuario y grupo | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| Bloqueo temporal | 30 s al insistir tras el límite | `src/security/rate-limit.js` |
| Enfriamiento por comando | `.team` 10 s · `.anuncio` 20 s · `.add`/`.expulsar` 15/10 s | `COMMAND_COOLDOWN` |
| Días para ser inactivo | 7 | `.config inactividad <días>` |
| Horas de reserva | 24 | `.config reserva <horas>` |
| Advertencias máximas | 3 | `.config warns <n>` |
| Longitud de nombre | 24 caracteres | `src/utils/text.js` |
| Longitud de personaje | 32 caracteres | `src/security/validation.js` |
| Longitud de anuncio | 1500 caracteres | `src/security/validation.js` |

## Comandos que el bot ignora

- Mensajes sin el prefijo (solo actualizan actividad, AFK y menciones).
- Un punto suelto o `.3` (no parecen comandos).
- Mensajes propios del bot, de difusión y de estados.
- Comandos de miembros cuando el grupo está cerrado con `.close`.
- Reacciones, stickers, contactos, ubicaciones y encuestas.
