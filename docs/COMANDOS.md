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
| `.menu` `[categoría]` | todos | Muestra el menú de comandos del bot. Con una categoría, la muestra filtrada.<br />Ejemplo: `.menu anime`<br />Alias: `.ayuda` `.comandos` `.start` `.menucompleto`<br />📩 También funciona por privado. |
| `.help` `[sección \| comando]` | todos | Explica todos los comandos del bot. Con un argumento detalla una sección o un comando.<br />Ejemplo: `.help`<br />📩 También funciona por privado. |
| `.ping` | todos | Latencia del bot y resumen de actividad.<br />Ejemplo: `.ping`<br />Alias: `.p`<br />📩 También funciona por privado. |
| `.botinfo` | todos | Información técnica del bot: versión, grupos, fichas y sub-bots activos.<br />Ejemplo: `.botinfo`<br />Alias: `.infobot`<br />📩 También funciona por privado. |
| `.status` | todos | Muestra el estado del bot: memoria, CPU, grupos, fichas y tiempo activo.<br />Ejemplo: `.status`<br />Alias: `.botstatus` `.estado`<br />📩 También funciona por privado. |
| `.id` | todos | Muestra tu identidad de WhatsApp: nombre, JID, contacto y rangos.<br />Ejemplo: `.id`<br />Alias: `.user` `.me` `.miid` `.myid` `.quien-soy`<br />📩 También funciona por privado. |
| `.pairing` | todos | Devuelve el pairing code REAL de WhatsApp del sub-bot que estás vinculando.<br />Ejemplo: `.pairing`<br />Alias: `.key` `.clave` `.codigo` `.código` `.pairingcode` `.vincular`<br />📩 También funciona por privado. |
| `.owner` | todos | Muestra al owner del bot (número enmascarado).<br />Ejemplo: `.owner`<br />Alias: `.creador` `.dev` |

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
| `.acceptrol` `[#id \| personaje]` | admins | Aprueba una solicitud de personaje (responde al aviso o indica el folio).<br />Ejemplo: `.acceptrol #12`<br />Alias: `.aprobarrol` `.aprobar`<br />⚠ También funciona respondiendo al mensaje del aviso de solicitud. |
| `.denyrol` `[#id \| personaje] [motivo]` | admins | Rechaza una solicitud de personaje. No modifica el personaje anterior.<br />Ejemplo: `.denyrol #12 Ese personaje es para otro team`<br />Alias: `.rechazarrol` `.denegar` |
| `.resetrol` `<@usuario>` | admins | Libera el personaje de otro integrante sin borrar su registro.<br />Ejemplo: `.resetrol @usuario` |
| `.add` `<@usuario \| número>` | admins | Intenta añadir a alguien al grupo. No lo registra automáticamente.<br />Ejemplo: `.add 5215512345678`<br />⚠ WhatsApp puede impedírselo según la privacidad del destino; el bot informa el motivo real. |
| `.expulsar` `<@usuario> [motivo]` | admins · **pide confirmación** | Expulsa a un integrante del grupo tras confirmar.<br />Ejemplo: `.expulsar @usuario Spam en el rol`<br />Alias: `.kick` |
| `.ban` `<@usuario> [motivo]` | admins · **pide confirmación** | Expulsa y añade a la lista negra. Si vuelve a entrar, se le expulsa otra vez.<br />Ejemplo: `.ban @usuario Raid` |
| `.unban` `<@usuario \| número>` | admins | Saca a alguien de la lista de bloqueados.<br />Ejemplo: `.unban 5215512345678` |
| `.bloqueados` | admins | Muestra la lista negra del grupo.<br />Ejemplo: `.bloqueados` |
| `.warn` `<@usuario> <motivo>` | admins | Añade una advertencia. Con 3 (configurable) se expulsa automáticamente.<br />Ejemplo: `.warn @usuario Spam`<br />Alias: `.advertir` |
| `.unwarn` `<@usuario>` | admins | Retira la advertencia más reciente de un integrante.<br />Ejemplo: `.unwarn @usuario`<br />Alias: `.quitarwarn` |
| `.warns` `<@usuario>` | admins | Historial de advertencias de un integrante.<br />Ejemplo: `.warns @usuario` |
| `.anuncio` `<mensaje>` | admins | Publica un anuncio con formato decorado. Usa "@todos" al inicio para mencionar.<br />Ejemplo: `.anuncio @todos Hoy hay evento de rol a las 21:00`<br />Alias: `.announce` |
| `.close` | admins | Cierra el grupo: solo los administradores pueden escribir.<br />Ejemplo: `.close`<br />Alias: `.cerrar` |
| `.open` | admins | Abre el grupo: todos pueden escribir de nuevo.<br />Ejemplo: `.open`<br />Alias: `.abrir` |
| `.invite` | admins | Genera el enlace de invitación del grupo (la vía fiable para añadir gente).<br />Ejemplo: `.invite` |
| `.promote` `<@usuario>` | admins | Le da el rango de administrador del grupo a un usuario en WhatsApp.<br />Ejemplo: `.promote @usuario`<br />Alias: `.daradmin` `.promover` `.haceradmin` |
| `.demote` `<@usuario>` | admins | Le quita el rango de administrador del grupo a un usuario en WhatsApp.<br />Ejemplo: `.demote @usuario`<br />Alias: `.quitaradmin` `.degradar` `.demotion` |
| `.tagall` `[mensaje]` | admins | Menciona a todos los participantes del grupo con un mensaje.<br />Ejemplo: `.tagall reunión a las 21:00`<br />Alias: `.todos` `.all` `.invocar` |
| `.notify` `<mensaje>` | admins | Envía un aviso mencionando a todos los participantes del grupo.<br />Ejemplo: `.notify hoy hay evento a las 21:00`<br />Alias: `.tag` `.n` `.avisar` `.hidetag` `.notificar` |
| `.link` | admins | Muestra el enlace de invitación actual del grupo.<br />Ejemplo: `.link`<br />Alias: `.enlace` `.grouplink` |
| `.revoke` | admins | Revoca el enlace de invitación del grupo y genera uno nuevo.<br />Ejemplo: `.revoke`<br />Alias: `.resetlink` `.resetearlink` `.revocar` `.nuevolink` |
| `.mute` `<@usuario> [motivo]` | admins | Silencia a un usuario: sus mensajes se borran automáticamente.<br />Ejemplo: `.mute @usuario spam`<br />Alias: `.silenciar` `.mutear` |
| `.unmute` `<@usuario>` | admins | Le quita el silencio a un usuario para que pueda escribir de nuevo.<br />Ejemplo: `.unmute @usuario`<br />Alias: `.desmutear` `.unsilenciar` `.desilenciar` |
| `.mutelist` | admins | Muestra la lista de usuarios silenciados del grupo.<br />Ejemplo: `.mutelist`<br />Alias: `.listmute` `.silenciados` `.muteds` |
| `.welcome` `[on\|off]` | admins | Activa o desactiva la bienvenida automática. Sin argumento muestra el estado.<br />Ejemplo: `.welcome on`<br />Alias: `.bienvenida` |
| `.bye` `[on\|off]` | admins | Activa o desactiva la despedida automática. Sin argumento muestra el estado.<br />Ejemplo: `.bye on`<br />Alias: `.despedida` `.goodbye` |
| `.setwelcome` `<mensaje>` | admins | Guarda el mensaje personalizado de bienvenida. Variables: {user} {group} {prefix}.<br />Ejemplo: `.setwelcome ¡Bienvenido, {user}! Lee {prefix}reglas`<br />Alias: `.setbienvenida` |
| `.setbye` `<mensaje>` | admins | Guarda el mensaje personalizado de despedida. Variables: {user} {group} {prefix}.<br />Ejemplo: `.setbye {user} dejó el team. ¡Suerte!`<br />Alias: `.setdespedida` |
| `.testwelcome` | admins | Muestra una vista previa de la bienvenida con tus propios datos.<br />Ejemplo: `.testwelcome`<br />Alias: `.testbienvenida` `.probarwelcome` |
| `.testbye` | admins | Muestra una vista previa de la despedida con tus propios datos.<br />Ejemplo: `.testbye`<br />Alias: `.testdespedida` `.probarbye` |
| `.onlyadmin` `[on\|off]` | admins | Activa el modo solo administradores: solo los admins pueden usar comandos.<br />Ejemplo: `.onlyadmin on`<br />Alias: `.adminonly` `.soloadmin` `.modoadmin`<br />⚠ El owner del bot siempre puede usar comandos aunque el modo esté activo. |
| `.alerts` `[on\|off]` | admins | Activa o desactiva las alertas y avisos automáticos del grupo.<br />Ejemplo: `.alertas off`<br />Alias: `.alertas` `.avisos` |
| `.antilink` `[on\|off]` | admins | Activa la protección antienlaces: borra los enlaces enviados por no-admins.<br />Ejemplo: `.antilink on`<br />Alias: `.antienlace` `.antienlaces` |

## 𓆩 🧈 𓆪 ⑦ ANIME

| Comando | Permiso | Qué hace |
|---|---|---|
| `.angry` `[@usuario]` | todos | Muestra enojo hacia alguien o a ti mismo.<br />Ejemplo: `.angry @usuario`<br />Alias: `.enojar` |
| `.bath` `[@usuario]` | todos | Se baña solo o con alguien.<br />Ejemplo: `.bath @usuario` |
| `.bite` `[@usuario]` | todos | Muerde a alguien o a ti mismo.<br />Ejemplo: `.bite @usuario`<br />Alias: `.morder` |
| `.bleh` `[@usuario]` | todos | Hace una mueca de desagrado.<br />Ejemplo: `.bleh @usuario` |
| `.blush` `[@usuario]` | todos | Se sonroja por alguien o por algo.<br />Ejemplo: `.blush @usuario` |
| `.bored` `[@usuario]` | todos | Está aburrido solo o con alguien.<br />Ejemplo: `.bored @usuario`<br />Alias: `.aburrido` |
| `.coffee` `[@usuario]` | todos | Toma café solo o con alguien.<br />Ejemplo: `.coffee @usuario`<br />Alias: `.cafe` |
| `.cry` `[@usuario]` | todos | Llora por alguien o por ti mismo.<br />Ejemplo: `.cry @usuario`<br />Alias: `.llorar` |
| `.cuddle` `[@usuario]` | todos | Se acurruca solo o con alguien.<br />Ejemplo: `.cuddle @usuario` |
| `.dance` `[@usuario]` | todos | Baila solo o con alguien.<br />Ejemplo: `.dance @usuario`<br />Alias: `.bailar` |
| `.drunk` `[@usuario]` | todos | Está borracho solo o con alguien.<br />Ejemplo: `.drunk @usuario` |
| `.eat` `[@usuario]` | todos | Come solo o con alguien.<br />Ejemplo: `.eat @usuario`<br />Alias: `.comer` |
| `.handhold` `[@usuario]` | todos | Toma la mano de alguien o de sí mismo.<br />Ejemplo: `.handhold @usuario` |
| `.happy` `[@usuario]` | todos | Está feliz solo o con alguien.<br />Ejemplo: `.happy @usuario`<br />Alias: `.feliz` |
| `.highfive` `[@usuario]` | todos | Choca los cinco con alguien o consigo mismo.<br />Ejemplo: `.highfive @usuario` |
| `.hug` `[@usuario]` | todos | Envía un abrazo a alguien o a ti mismo.<br />Ejemplo: `.hug @usuario`<br />Alias: `.abrazo` |
| `.jump` `[@usuario]` | todos | Salta solo o con alguien.<br />Ejemplo: `.jump @usuario` |
| `.kill` `[@usuario]` | todos | Elimina a alguien o a ti mismo (en broma).<br />Ejemplo: `.kill @usuario`<br />Alias: `.matar` |
| `.kiss` `[@usuario]` | todos | Envía un beso a alguien o a ti mismo.<br />Ejemplo: `.kiss @usuario`<br />Alias: `.muak` |
| `.kisscheek` `[@usuario]` | todos | Da un beso en la mejilla a alguien o a ti mismo.<br />Ejemplo: `.kisscheek @usuario`<br />Alias: `.beso` |
| `.laugh` `[@usuario]` | todos | Ríe solo o con alguien.<br />Ejemplo: `.laugh @usuario` |
| `.lick` `[@usuario]` | todos | Lame a alguien o a sí mismo.<br />Ejemplo: `.lick @usuario` |
| `.love` `[@usuario]` | todos | Declara tu amor a alguien o a ti mismo.<br />Ejemplo: `.love @usuario`<br />Alias: `.amor` |
| `.nope` `[@usuario]` | todos | Dice que no con un gesto.<br />Ejemplo: `.nope @usuario` |
| `.pat` `[@usuario]` | todos | Acaricia a alguien o a sí mismo.<br />Ejemplo: `.pat @usuario` |
| `.pout` `[@usuario]` | todos | Hace pucheros solo o por alguien.<br />Ejemplo: `.pout @usuario` |
| `.punch` `[@usuario]` | todos | Golpea a alguien o a ti mismo.<br />Ejemplo: `.punch @usuario`<br />Alias: `.pegar` |
| `.push` `[@usuario]` | todos | Empuja a alguien o a sí mismo.<br />Ejemplo: `.push @usuario` |
| `.run` `[@usuario]` | todos | Corre solo o con alguien.<br />Ejemplo: `.run @usuario`<br />Alias: `.correr` |
| `.sad` `[@usuario]` | todos | Está triste solo o por alguien.<br />Ejemplo: `.sad @usuario`<br />Alias: `.triste` |
| `.scared` `[@usuario]` | todos | Está asustado solo o por alguien.<br />Ejemplo: `.scared @usuario` |
| `.seduce` `[@usuario]` | todos | Intenta seducir a alguien o a sí mismo.<br />Ejemplo: `.seduce @usuario`<br />Alias: `.seducir` |
| `.shy` `[@usuario]` | todos | Está tímido solo o por alguien.<br />Ejemplo: `.shy @usuario`<br />Alias: `.timido` |
| `.slap` `[@usuario]` | todos | Da una bofetada a alguien o a ti mismo.<br />Ejemplo: `.slap @usuario` |
| `.sleep` `[@usuario]` | todos | Duerme solo o con alguien.<br />Ejemplo: `.sleep @usuario` |
| `.smile` `[@usuario]` | todos | Sonríe a alguien o a ti mismo.<br />Ejemplo: `.smile @usuario`<br />Alias: `.sonreir` |
| `.smoke` `[@usuario]` | todos | Fuma solo o con alguien.<br />Ejemplo: `.smoke @usuario`<br />Alias: `.fumar` |
| `.spit` `[@usuario]` | todos | Escupe a alguien o al suelo.<br />Ejemplo: `.spit @usuario`<br />Alias: `.escupir` |
| `.step` `[@usuario]` | todos | Pisa a alguien o algo accidentalmente.<br />Ejemplo: `.step @usuario`<br />Alias: `.pisar` |
| `.think` `[@usuario]` | todos | Piensa solo o en alguien.<br />Ejemplo: `.think @usuario` |
| `.walk` `[@usuario]` | todos | Camina solo o con alguien.<br />Ejemplo: `.walk @usuario` |
| `.wave` `[@usuario]` | todos | Saluda a alguien o al mundo.<br />Ejemplo: `.wave @usuario`<br />Alias: `.hola` |
| `.wink` `[@usuario]` | todos | Guiña un ojo a alguien o a sí mismo.<br />Ejemplo: `.wink @usuario` |

## 𓆩 🪷 𓆪 ⑧ ECONOMÍA · ¥enes

| Comando | Permiso | Qué hace |
|---|---|---|
| `.bal` `[@usuario]` | todos | Muestra el balance de ¥enes (cartera, banco y total) de un usuario.<br />Ejemplo: `.bal @usuario`<br />Alias: `.balance` `.coins` |
| `.baltop` | todos | Muestra el ranking de usuarios con más ¥enes del grupo.<br />Ejemplo: `.baltop`<br />Alias: `.eboard` `.economytop` |
| `.cf` `<cantidad> [cara\|cruz]` | todos | Apuesta ¥enes al cara o cruz. Apuesta mínima de 200 ¥enes.<br />Ejemplo: `.cf 500 cara`<br />Alias: `.coinflip` `.flip` |
| `.crime` | todos | Comete un crimen para ganar (o perder) ¥enes. Enfriamiento de 5 minutos.<br />Ejemplo: `.crime` |
| `.daily` | todos | Reclama tu recompensa diaria de ¥enes con racha creciente por día.<br />Ejemplo: `.daily` |
| `.deposit` `<cantidad\|all>` | todos | Deposita ¥enes de la cartera al banco, donde nadie te los puede robar.<br />Ejemplo: `.deposit 1000`<br />Alias: `.dep` `.d` |
| `.einfo` `[@usuario]` | todos | Muestra el tiempo restante de cada comando de economía de un usuario.<br />Ejemplo: `.einfo @usuario`<br />Alias: `.economyinfo` `.cooldowns` |
| `.pay` `<@usuario> <cantidad>` | todos | Transfiere ¥enes de tu cartera a otro usuario del grupo.<br />Ejemplo: `.pay @usuario 500`<br />Alias: `.transfer` `.give` |
| `.rt` `<rojo\|negro> <cantidad>` | todos | Apuesta ¥enes a la ruleta (rojo o negro). Apuesta mínima de 200 ¥enes.<br />Ejemplo: `.rt rojo 500`<br />Alias: `.ruleta` `.roulette` `.rtl` |
| `.slut` | todos | Trabaja el turno nocturno para ganar (o perder) ¥enes. Enfriamiento de 4 minutos.<br />Ejemplo: `.slut` |
| `.rob` `<@usuario>` | todos | Roba ¥enes de la cartera de otro usuario. Si fallas, pagas multa. Enfriamiento de 10 minutos.<br />Ejemplo: `.rob @usuario`<br />Alias: `.steal` `.robar` |
| `.with` `<cantidad\|all>` | todos | Retira ¥enes del banco a tu cartera para apostar o transferir.<br />Ejemplo: `.with 1000`<br />Alias: `.withdraw` `.retirar` `.wd` |
| `.work` | todos | Trabaja para ganar ¥enes. Enfriamiento de 1 minuto.<br />Ejemplo: `.work`<br />Alias: `.w` |

## 𓆩 🛍️ 𓆪 ⑨ DESCARGAS

| Comando | Permiso | Qué hace |
|---|---|---|
| `.play` `<título o enlace>` | todos | Busca audio de YouTube por título o enlace y devuelve el resultado.<br />Ejemplo: `.play bad bunny diles`<br />Alias: `.playaudio` `.audio`<br />📩 También funciona por privado. |
| `.play2` `<título o enlace>` | todos | Busca video de YouTube por título o enlace y devuelve el resultado.<br />Ejemplo: `.play2 shakira bzrp`<br />Alias: `.ytmp4` `.video` `.playv`<br />📩 También funciona por privado. |
| `.yta` `<título o enlace>` | todos | Descarga y envía audio de YouTube en formato MP3.<br />Ejemplo: `.yta https://youtu.be/xxxx`<br />Alias: `.ytmp3`<br />📩 También funciona por privado. |
| `.tiktok` `<enlace>` | todos | Descarga videos de TikTok a partir de su enlace.<br />Ejemplo: `.tiktok https://www.tiktok.com/…`<br />Alias: `.tt` `.tk`<br />📩 También funciona por privado. |
| `.instagram` `<enlace>` | todos | Descarga contenido público de Instagram (reels, fotos e historias).<br />Ejemplo: `.instagram https://www.instagram.com/…`<br />Alias: `.ig` `.igdl`<br />📩 También funciona por privado. |
| `.spotify` `<título o enlace>` | todos | Descarga música de Spotify por título o enlace.<br />Ejemplo: `.spotify https://open.spotify.com/…`<br />Alias: `.sp` `.spotifydl`<br />📩 También funciona por privado. |
| `.pinterest` `<búsqueda>` | todos | Busca imágenes de Pinterest por palabra clave.<br />Ejemplo: `.pinterest gatos samurái`<br />Alias: `.pin`<br />📩 También funciona por privado. |
| `.lyrics` `<canción>` | todos | Busca la letra de una canción por título y artista.<br />Ejemplo: `.lyrics shakira bzrp`<br />Alias: `.letra` `.lyric`<br />📩 También funciona por privado. |

## 𓆩 🌸 𓆪 ⑩ PERFIL EXTENDIDO

| Comando | Permiso | Qué hace |
|---|---|---|
| `.marry` `<@usuario>` | todos | Proponle matrimonio a otro usuario. Si ambos se proponen, se casan.<br />Ejemplo: `.marry @usuario`<br />Alias: `.casar` `.matrimonio` `.casarse` |
| `.divorce` | todos | Te divorcias de tu pareja actual y terminas el matrimonio.<br />Ejemplo: `.divorce`<br />Alias: `.divorciar` `.divorcio` `.div` |
| `.history` `[@usuario]` | todos | Muestra el historial de matrimonios de un usuario del grupo.<br />Ejemplo: `.history @usuario`<br />Alias: `.historial` `.historialmatrimonial` `.marryhistory` `.marryhist` `.mh` |
| `.setbirth` `<mes/día>` | todos | Guarda tu fecha de cumpleaños (mes/día, año opcional).<br />Ejemplo: `.setbirth 12/25`<br />Alias: `.setcumple` `.setbirthday` `.setb` `.micumple`<br />📩 También funciona por privado. |
| `.setdesc` `<texto>` | todos | Guarda la descripción de tu perfil (sin texto la elimina).<br />Ejemplo: `.setdesc amo el rol nocturno`<br />Alias: `.setbio` `.setdescription` `.setd` `.midesc`<br />📩 También funciona por privado. |
| `.setgenre` `<hombre\|mujer\|otro>` | todos | Guarda el género de tu perfil.<br />Ejemplo: `.setgenre mujer`<br />Alias: `.setgenero` `.setg` `.migenero`<br />📩 También funciona por privado. |
| `.pfp` `[@usuario\|número]` | todos | Muestra la foto de perfil de un usuario del grupo.<br />Ejemplo: `.pfp @usuario`<br />Alias: `.getpfp` `.foto` `.avatar` `.pp` `.getpp` `.fotoperfil` |

## 𓆩 ⭐ 𓆪 ⑪ STICKERS

| Comando | Permiso | Qué hace |
|---|---|---|
| `.s` `[pack \| autor]` | todos | Convierte una imagen adjunta o citada en un sticker WebP y lo envía al chat.<br />Ejemplo: `.s (con una imagen adjunta o citada; también puedes responder a ella)`<br />Alias: `.sticker` `.stiker` `.wm`<br />📩 También funciona por privado. |
| `.spack` `<nombre del pack>` | todos | Crea y envía un sticker por cada foto del álbum al que respondas; el autor es el nombre del bot.<br />Ejemplo: `.spack Mis fotos`<br />📩 También funciona por privado. |
| `.setmeta` `<pack \| autor>` | todos | Guarda por grupo tus metadatos predeterminados de nombre de pack y autor para tus stickers.<br />Ejemplo: `.setmeta mi pack \| yo`<br />Alias: `.sm` `.setpack` `.mimetadatos` |
| `.delmeta` | todos | Elimina tus metadatos de stickers guardados.<br />Ejemplo: `.delmeta`<br />Alias: `.dm` `.delpack` |
| `.brat` `<texto>` | todos | Genera y envía un sticker WebP tipo BRAT con el texto que escribas.<br />Ejemplo: `.brat hola mundo`<br />Alias: `.bratv` `.bratty`<br />📩 También funciona por privado. |
| `.attp` `<texto>` | todos | Genera y envía un sticker WebP animado con texto de colores.<br />Ejemplo: `.attp hola mundo`<br />📩 También funciona por privado. |
| `.ttp` `<texto>` | todos | Genera y envía un sticker WebP con texto y contorno.<br />Ejemplo: `.ttp hola mundo`<br />📩 También funciona por privado. |
| `.ssearch` `<búsqueda>` | todos | Busca paquetes de stickers por palabra clave en Sticker.ly.<br />Ejemplo: `.ssearch gatos`<br />Alias: `.stickerly` `.stickers` `.buscarsticker` `.ss`<br />📩 También funciona por privado. |

## 𓆩 💐 𓆪 ⑫ HERRAMIENTAS

| Comando | Permiso | Qué hace |
|---|---|---|
| `.ia` `<pregunta>` | todos | Pregunta a la inteligencia artificial del bot y recibe una respuesta.<br />Ejemplo: `.ia quién eres`<br />Alias: `.chat` `.bot` `.gpt` `.chatgpt` `.gemini`<br />📩 También funciona por privado. |
| `.ver` | todos | Revela el mensaje de vista única que citaste (solo texto).<br />Ejemplo: `.ver (citando el mensaje)`<br />Alias: `.read` `.view` `.readviewonce` `.vv`<br />📩 También funciona por privado. |
| `.toimg` | todos | Convierte el sticker citado en una imagen.<br />Ejemplo: `.toimg (citando un sticker)`<br />Alias: `.toimage` `.img` `.tophoto`<br />📩 También funciona por privado. |
| `.tomp3` | todos | Convierte el video o nota de voz citada en audio MP3.<br />Ejemplo: `.tomp3 (citando un video)`<br />Alias: `.toaudio` `.mp3`<br />📩 También funciona por privado. |

## 𓆩 🍰 𓆪 ⑬ LOGOS

| Comando | Permiso | Qué hace |
|---|---|---|
| `.logoalas` `<texto>` | todos | Crea un logo con efecto de alas de ángel galácticas.<br />Ejemplo: `.logoalas mi texto`<br />📩 También funciona por privado. |
| `.logoamongus` `<texto>` | todos | Crea un logo estilo Among Us.<br />Ejemplo: `.logoamongus mi texto`<br />📩 También funciona por privado. |
| `.logoangel` `<texto>` | todos | Crea un logo con efecto de alas de ángel.<br />Ejemplo: `.logoangel mi texto`<br />📩 También funciona por privado. |
| `.logoarmy` `<texto>` | todos | Crea un logo de estilo militar y FPS gaming.<br />Ejemplo: `.logoarmy mi texto`<br />📩 También funciona por privado. |
| `.logochicagamer` `<texto>` | todos | Crea un logo de mascota gamer femenina.<br />Ejemplo: `.logochicagamer mi texto`<br />📩 También funciona por privado. |
| `.logochristmas` `<texto>` | todos | Crea un logo con efecto navideño.<br />Ejemplo: `.logochristmas mi texto`<br />📩 También funciona por privado. |
| `.logocielo` `<texto>` | todos | Crea un logo con efecto de nubes en el cielo.<br />Ejemplo: `.logocielo mi texto`<br />📩 También funciona por privado. |
| `.logocorazon` `<texto>` | todos | Crea un logo con efecto de corazón y linterna.<br />Ejemplo: `.logocorazon mi texto`<br />📩 También funciona por privado. |
| `.logodragonball` `<texto>` | todos | Crea un logo con efecto de texto estilo Dragon Ball.<br />Ejemplo: `.logodragonball mi texto`<br />📩 También funciona por privado. |
| `.logofuturista` `<texto>` | todos | Crea un logo con efecto de luz tecnológica futurista.<br />Ejemplo: `.logofuturista mi texto`<br />📩 También funciona por privado. |
| `.logogaming` `<texto>` | todos | Crea un logo de equipo de esports y gaming.<br />Ejemplo: `.logogaming mi texto`<br />📩 También funciona por privado. |
| `.logogatito` `<texto>` | todos | Crea un logo con texto escrito en vidrio empañado.<br />Ejemplo: `.logogatito mi texto`<br />📩 También funciona por privado. |
| `.logoglitch` `<texto>` | todos | Crea un logo con efecto de texto glitch digital.<br />Ejemplo: `.logoglitch mi texto`<br />📩 También funciona por privado. |
| `.logograffiti3d` `<texto>` | todos | Crea un logo con efecto de graffiti 3D.<br />Ejemplo: `.logograffiti3d mi texto`<br />📩 También funciona por privado. |
| `.logohorror` `<texto>` | todos | Crea un logo con efecto de escritura de sangre.<br />Ejemplo: `.logohorror mi texto`<br />📩 También funciona por privado. |
| `.logolol` `<texto>` | todos | Crea un logo estilo League of Legends.<br />Ejemplo: `.logolol mi texto`<br />📩 También funciona por privado. |
| `.logomatrix` `<texto>` | todos | Crea un logo con efecto de código Matrix.<br />Ejemplo: `.logomatrix mi texto`<br />📩 También funciona por privado. |
| `.logonaruto` `<texto>` | todos | Crea un logo con estilo de texto Naruto Shippuden.<br />Ejemplo: `.logonaruto mi texto`<br />📩 También funciona por privado. |
| `.logoneon` `<texto>` | todos | Crea un logo con efecto de neón glitch.<br />Ejemplo: `.logoneon mi texto`<br />📩 También funciona por privado. |
| `.logonube` `<texto>` | todos | Crea un logo con efecto de texto en las nubes.<br />Ejemplo: `.logonube mi texto`<br />📩 También funciona por privado. |
| `.logopareja` `<texto>` | todos | Crea un logo con efecto de sombra y luz solar.<br />Ejemplo: `.logopareja mi texto`<br />📩 También funciona por privado. |
| `.logopubg` `<texto>` | todos | Crea un logo estilo PUBG con personaje tierno.<br />Ejemplo: `.logopubg mi texto`<br />📩 También funciona por privado. |
| `.logopubgfem` `<texto>` | todos | Crea un logo mascota PUBG para equipos de esports.<br />Ejemplo: `.logopubgfem mi texto`<br />📩 También funciona por privado. |
| `.logosad` `<texto>` | todos | Crea un logo con texto escrito en vidrio mojado.<br />Ejemplo: `.logosad mi texto`<br />📩 También funciona por privado. |
| `.logosolitario` `<texto>` | todos | Crea un logo con efecto tipográfico sobre pavimento.<br />Ejemplo: `.logosolitario mi texto`<br />📩 También funciona por privado. |

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
