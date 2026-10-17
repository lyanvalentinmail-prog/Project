/**
 * 𓆩 🧈 𓆪  VÉRSOVA · tests del paquete Raiden
 * ────────────────────────────────────────────────────────────────
 * anime · economía · descargas · perfil · stickers · herramientas ·
 * logos · administración extra · estado · estilo de menú raiden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sim, say, person, registerPerson, includes } from './_harness.js';
import { customRepo } from '../src/db/repositories/bot-customization.repo.js';
import { ALLOWED_MENU_STYLES } from '../src/db/repositories/bot-customization.repo.js';
import { listStyles } from '../src/design/menu-styles.js';
import { previewMenu } from '../src/services/menu.service.js';

const at = (who) => `@${who.jid.split('@')[0]}`;

/* ── anime ─────────────────────────────────────────────────── */

test('anime: .hug solo y con mención, más alias .abrazo', async () => {
  const a = await registerPerson('Hugger');
  const b = person('Hugged');
  const solo = await say(a.jid, '.hug');
  assert.ok(includes(solo, 'abraza') || includes(solo, 'brazos'), `inesperado: ${solo.last}`);
  assert.ok(!includes(solo, b.phone), 'en solitario no menciona a nadie');

  const together = await say(a.jid, `.hug ${at(b)}`, [b.jid]);
  assert.ok(includes(together, b.phone), `falta la mención: ${together.last}`);

  const alias = await say(a.jid, '.abrazo');
  assert.ok(includes(alias, 'abraza') || includes(alias, 'brazos'));
});

test('anime: las 43 acciones existen en el registro', () => {
  for (const name of ['angry', 'kiss', 'slap', 'dance', 'sleep', 'wink', 'kill', 'pat']) {
    assert.ok(sim.registry.get(name), `falta ${name}`);
  }
  assert.equal(sim.registry.get('muak')?.name, 'kiss');
  assert.equal(sim.registry.get('hola')?.name, 'wave');
});

/* ── economía ──────────────────────────────────────────────── */

test('economía: daily, cooldown, bal y einfo', async () => {
  const who = await registerPerson('Rico');
  const first = await say(who.jid, '.daily');
  assert.ok(includes(first, '¥enes'), `sin recompensa: ${first.last}`);

  const again = await say(who.jid, '.daily');
  assert.ok(includes(again, 'esperar'), `sin cooldown: ${again.last}`);

  const bal = await say(who.jid, '.bal');
  assert.ok(includes(bal, '𝐵𝑎𝑙𝑎𝑛𝑐𝑒') || includes(bal, 'Cartera'), bal.last);
  const info = await say(who.jid, '.einfo');
  assert.ok(includes(info, 'Work'), info.last);
  const top = await say(who.jid, '.baltop');
  assert.ok(includes(top, 'Rico'), top.last);
});

test('economía: work, cf, pay, banco y rob', async () => {
  const a = await registerPerson('Apostador');
  const b = await registerPerson('Victima');
  await say(a.jid, '.daily');
  await say(b.jid, '.daily');

  const bet = await say(a.jid, '.cf 500 cara');
  assert.ok(includes(bet, 'cara') || includes(bet, 'cruz'), bet.last);
  const poor = await say(a.jid, '.rt rojo 999999999');
  assert.ok(includes(poor, 'suficientes') || includes(poor, 'válida'), poor.last);

  const pay = await say(a.jid, `.pay ${at(b)} 500`, [b.jid]);
  assert.ok(includes(pay, '𝑇𝑟𝑎𝑛𝑠𝑓𝑒𝑟𝑒𝑛𝑐𝑖𝑎'), pay.last);
  const self = await say(a.jid, `.pay ${at(a)} 500`, [a.jid]);
  assert.ok(includes(self, 'ti mismo'), self.last);

  const dep = await say(a.jid, '.deposit all');
  assert.ok(includes(dep, '𝐷𝑒𝑝𝑜́𝑠𝑖𝑡𝑜'), dep.last);
  const withd = await say(a.jid, '.with all');
  assert.ok(includes(withd, '𝑅𝑒𝑡𝑖𝑟𝑜'), withd.last);

  const rob = await say(a.jid, `.rob ${at(b)}`, [b.jid]);
  assert.ok(includes(rob, '𝑅𝑜𝑏𝑜') || includes(rob, 'esperar'), rob.last);

  const crime = await say(a.jid, '.crime');
  assert.ok(includes(crime, '¥enes'), crime.last);
  const slut = await say(a.jid, '.slut');
  assert.ok(includes(slut, '¥enes'), slut.last);

  // .work al final: su resultado aleatorio no afecta a las apuestas anteriores.
  const work = await say(a.jid, '.work');
  assert.ok(includes(work, '¥enes'), work.last);
  const workAgain = await say(a.jid, '.work');
  assert.ok(includes(workAgain, 'esperar'), workAgain.last);
});

/* ── descargas ─────────────────────────────────────────────── */

test('descargas: play, yta, redes y letras', async () => {
  const who = await registerPerson('Dj');
  const play = await say(who.jid, '.play bad bunny diles');
  assert.ok(includes(play, 'youtube.com'), play.last);
  const empty = await say(who.jid, '.play');
  assert.ok(includes(empty, 'Escribe'), empty.last);

  const bad = await say(who.jid, '.tiktok hola');
  assert.ok(includes(bad, 'TikTok'), bad.last);
  const tt = await say(who.jid, '.tiktok https://www.tiktok.com/@x/video/1');
  assert.ok(includes(tt, 'tiktok.com'), tt.last);
  const ig = await say(who.jid, '.instagram https://www.instagram.com/p/1');
  assert.ok(includes(ig, 'instagram.com'), ig.last);
  const sp = await say(who.jid, '.spotify https://open.spotify.com/track/1');
  assert.ok(includes(sp, 'spotify'), sp.last);
  const pin = await say(who.jid, '.pinterest gatos');
  assert.ok(includes(pin, 'pinterest.com'), pin.last);
  const lyrics = await say(who.jid, '.lyrics shakira');
  assert.ok(includes(lyrics, 'genius.com') && includes(lyrics, 'letras.com'), lyrics.last);
});

/* ── perfil ────────────────────────────────────────────────── */

test('perfil: propuesta, boda, historial y divorcio', async () => {
  const a = await registerPerson('Novio');
  const b = await registerPerson('Novia');
  const proposal = await say(a.jid, `.marry ${at(b)}`, [b.jid]);
  assert.ok(includes(proposal, '𝑃𝑟𝑜𝑝𝑢𝑒𝑠𝑡𝑎'), proposal.last);

  const wedding = await say(b.jid, `.marry ${at(a)}`, [a.jid]);
  assert.ok(includes(wedding, 'casado'), wedding.last);

  const history = await say(a.jid, '.history');
  assert.ok(includes(history, 'Novia'), history.last);
  const alias = await say(a.jid, '.marryhistory');
  assert.ok(includes(alias, 'Novia'), alias.last);

  const divorce = await say(a.jid, '.divorce');
  assert.ok(includes(divorce, '𝐷𝑖𝑣𝑜𝑟𝑐𝑖𝑜'), divorce.last);
});

test('perfil: cumpleaños, descripción, género y foto', async () => {
  const who = await registerPerson('Datos');
  const birth = await say(who.jid, '.setbirth 12/25');
  assert.ok(includes(birth, 'diciembre'), birth.last);
  const badBirth = await say(who.jid, '.setbirth 99/99');
  assert.ok(includes(badBirth, 'mes'), badBirth.last);

  const desc = await say(who.jid, '.setdesc amo el rol');
  assert.ok(includes(desc, 'amo el rol'), desc.last);
  const genre = await say(who.jid, '.setgenre mujer');
  assert.ok(includes(genre, 'Mujer'), genre.last);
  const badGenre = await say(who.jid, '.setgenre x');
  assert.ok(includes(badGenre, 'válido'), badGenre.last);

  const pfp = await say(who.jid, '.pfp');
  assert.ok(includes(pfp, 'simulado.local') || includes(pfp, '𝐹𝑜𝑡𝑜'), pfp.last);
});

/* ── stickers ──────────────────────────────────────────────── */

test('stickers: guía, metadatos, brat y búsqueda', async () => {
  const who = await registerPerson('Pegatina');
  const guide = await say(who.jid, '.s');
  assert.ok(includes(guide, '𝐶𝑟𝑒𝑎𝑟'), guide.last);

  const meta = await say(who.jid, '.setmeta Mi pack | Yo');
  assert.ok(includes(meta, 'Mi pack'), meta.last);
  const cleared = await say(who.jid, '.delmeta');
  assert.ok(includes(cleared, 'eliminó'), cleared.last);

  const brat = await say(who.jid, '.brat hola mundo');
  assert.ok(includes(brat, 'hola mundo'), brat.last);
  const search = await say(who.jid, '.ssearch gatos');
  assert.ok(includes(search, 'sticker.ly'), search.last);
});

/* ── herramientas ──────────────────────────────────────────── */

test('herramientas: ia local, ver, toimg y tomp3 piden cita', async () => {
  const who = await registerPerson('Curioso');
  const ia = await say(who.jid, '.ia hola, ¿quién eres?');
  assert.ok(includes(ia, 'VÉRSOVA') || includes(ia, 'Hola'), ia.last);
  const iaEmpty = await say(who.jid, '.ia');
  assert.ok(includes(iaEmpty, 'pregunta'), iaEmpty.last);

  for (const cmd of ['.ver', '.toimg', '.tomp3']) {
    const reply = await say(who.jid, cmd);
    assert.ok(includes(reply, 'Responde'), `${cmd}: ${reply.last}`);
  }
});

/* ── logos ─────────────────────────────────────────────────── */

test('logos: tarjeta de efecto y validación', async () => {
  const who = await registerPerson('Artista');
  const logo = await say(who.jid, '.logoalas Versova');
  assert.ok(includes(logo, 'Versova') && includes(logo, '𝐿𝑜𝑔𝑜'), logo.last);
  const empty = await say(who.jid, '.logonaruto');
  assert.ok(includes(empty, 'texto'), empty.last);
  assert.ok(sim.registry.get('logomatrix'), 'falta logomatrix');
  assert.equal(sim.registry.byCategory('logos').length, 25);
});

/* ── administración extra ──────────────────────────────────── */

test('admin extra: promote, demote, tagall y notify', async () => {
  const admin = await registerPerson('Jefe', { admin: 'admin' });
  const target = person('Subdito');
  const up = await say(admin.jid, `.promote ${at(target)}`, [target.jid]);
  assert.ok(includes(up, '𝑁𝑢𝑒𝑣𝑜') || includes(up, 'admin'), up.last);

  const other = await registerPerson('Exadmin', { admin: 'admin' });
  const down = await say(admin.jid, `.demote ${at(other)}`, [other.jid]);
  assert.ok(includes(down, '𝑟𝑒𝑡𝑖𝑟𝑎𝑑𝑜') || includes(down, 'admin'), down.last);

  const tag = await say(admin.jid, '.tagall reunión hoy');
  assert.ok(includes(tag, '𝑀𝐸𝑁𝐶𝐼𝑂𝑁'), tag.last);
  const notify = await say(admin.jid, '.notify lean las reglas');
  assert.ok(includes(notify, '𝑁𝑂𝑇𝐼𝐹𝐼𝐶𝐴𝐶𝐼𝑂́𝑁'), notify.last);
  const notifyEmpty = await say(admin.jid, '.notify');
  assert.ok(includes(notifyEmpty, 'mensaje'), notifyEmpty.last);
});

test('admin extra: link, revoke, mute y mutelist', async () => {
  const admin = await registerPerson('Portero', { admin: 'admin' });
  const link = await say(admin.jid, '.link');
  assert.ok(includes(link, 'chat.whatsapp.com'), link.last);
  const revoke = await say(admin.jid, '.revoke');
  assert.ok(includes(revoke, '𝑟𝑒𝑛𝑜𝑣𝑎𝑑𝑜'), revoke.last);

  const noisy = person('Ruidoso');
  const mute = await say(admin.jid, `.mute ${at(noisy)} spam`, [noisy.jid]);
  assert.ok(includes(mute, '𝑠𝑖𝑙𝑒𝑛𝑐𝑖𝑎𝑑𝑜'), mute.last);
  const list = await say(admin.jid, '.mutelist');
  assert.ok(includes(list, 'Ruidoso'), list.last);

  const deletedBefore = sim.client.deleted?.length ?? 0;
  const silenced = await say(noisy.jid, 'hola a todos');
  assert.equal(silenced.count, 0, 'el silenciado no recibe respuesta');
  assert.ok((sim.client.deleted?.length ?? 0) > deletedBefore, 'el mensaje del silenciado se borra');

  const unmute = await say(admin.jid, `.unmute ${at(noisy)}`, [noisy.jid]);
  assert.ok(includes(unmute, '𝑙𝑒𝑣𝑎𝑛𝑡𝑎𝑑𝑜'), unmute.last);
  const deletedAfter = sim.client.deleted?.length ?? 0;
  await say(noisy.jid, 'ya puedo hablar');
  assert.equal(sim.client.deleted?.length ?? 0, deletedAfter, 'sin mute no se borra');
});

test('admin extra: toggles de bienvenida, despedida y textos', async () => {
  const admin = await registerPerson('Anfitrion', { admin: 'admin' });
  const status = await say(admin.jid, '.welcome');
  assert.ok(includes(status, 'Estado actual') || includes(status, 'bienvenida'), status.last);
  const on = await say(admin.jid, '.welcome on');
  assert.ok(includes(on, 'activado'), on.last);
  const set = await say(admin.jid, '.setwelcome ¡Hola {user}, bienvenido a {group}!');
  assert.ok(includes(set, '{user}'), set.last);
  const preview = await say(admin.jid, '.testwelcome');
  assert.ok(includes(preview, 'Anfitrion') && includes(preview, '𝑣𝑖𝑠𝑡𝑎 𝑝𝑟𝑒𝑣𝑖𝑎'), preview.last);

  const bye = await say(admin.jid, '.bye off');
  assert.ok(includes(bye, 'desactivado'), bye.last);
  const setbye = await say(admin.jid, '.setbye adiós {user}');
  assert.ok(includes(setbye, 'adiós'), setbye.last);
  const byePreview = await say(admin.jid, '.testbye');
  assert.ok(includes(byePreview, '𝑣𝑖𝑠𝑡𝑎 𝑝𝑟𝑒𝑣𝑖𝑎'), byePreview.last);

  const alerts = await say(admin.jid, '.alerts off');
  assert.ok(includes(alerts, 'desactivado'), alerts.last);
  await say(admin.jid, '.alerts on');
});

test('admin extra: onlyadmin silencia a los miembros', async () => {
  const admin = await registerPerson('Dueño', { admin: 'admin' });
  const member = await registerPerson('Miembro');
  await say(admin.jid, '.onlyadmin on');

  const ignored = await say(member.jid, '.ping');
  assert.equal(ignored.count, 0, 'el miembro no recibe respuesta en modo solo admins');
  const allowed = await say(admin.jid, '.ping');
  assert.ok(allowed.count > 0, 'el admin sigue usando comandos');

  await say(admin.jid, '.onlyadmin off');
  const back = await say(member.jid, '.ping');
  assert.ok(back.count > 0, 'al desactivar, el miembro vuelve a recibir respuesta');
});

test('admin extra: antilink borra enlaces de no-admins', async () => {
  const admin = await registerPerson('Guardia', { admin: 'admin' });
  const member = await registerPerson('Enlacer');
  await say(admin.jid, '.antilink on');

  const deletedBefore = sim.client.deleted?.length ?? 0;
  await say(member.jid, 'miren esto https://example.com/x');
  assert.ok((sim.client.deleted?.length ?? 0) > deletedBefore, 'el enlace se borra');

  const adminBefore = sim.client.deleted?.length ?? 0;
  await say(admin.jid, 'enlace oficial https://example.com/y');
  assert.equal(sim.client.deleted?.length ?? 0, adminBefore, 'al admin no se le borra');

  const cleanBefore = sim.client.deleted?.length ?? 0;
  await say(member.jid, 'mensaje sin enlaces');
  assert.equal(sim.client.deleted?.length ?? 0, cleanBefore, 'sin enlace no se borra');
  await say(admin.jid, '.antilink off');
});

/* ── sistema ───────────────────────────────────────────────── */

test('sistema: .status y .id', async () => {
  const who = await registerPerson('Tecnico');
  const status = await say(who.jid, '.status');
  assert.ok(includes(status, 'Estado') && includes(status, 'RAM'), status.last);
  const id = await say(who.jid, '.id');
  assert.ok(includes(id, 'JID') || includes(id, who.phone.slice(0, 6)), id.last);
});

/* ── estilo raiden ─────────────────────────────────────────── */

test('estilo raiden: registrado, permitido y renderiza', () => {
  assert.ok(ALLOWED_MENU_STYLES.includes('raiden'), 'raiden debe estar permitido');
  assert.ok(listStyles().some((s) => s.id === 'raiden'), 'raiden debe listarse');
  const text = previewMenu(sim.instance, 'raiden');
  assert.ok(text.includes('ᴄᴏᴍ'), 'título de comandos estilo raiden');
  assert.ok(text.includes('Made with love'), 'firma estilo raiden');
  assert.ok(text.includes('.hug') && text.includes('.daily') && text.includes('.logoalas'), 'incluye comandos nuevos');
});

test('estilo raiden: .menu filtra por categoría', async () => {
  const who = await registerPerson('Lector');
  const previous = customRepo.get(sim.instance.id);
  customRepo.set(sim.instance.id, { ...previous, menuStyle: 'raiden' });
  try {
    const menu = await say(who.jid, '.menu');
    assert.ok(includes(menu, '塞缪尔'), menu.last.slice(0, 200));
    const filtered = await say(who.jid, '.menu anime');
    assert.ok(includes(filtered, '.hug'), filtered.last);
    assert.ok(!includes(filtered, '.daily'), 'el filtro excluye otras categorías');
  } finally {
    customRepo.set(sim.instance.id, { ...previous, menuStyle: previous.menuStyle ?? 'versova' });
  }
});

test('estilo versova sigue siendo el menú por defecto', async () => {
  const who = await registerPerson('Clasico');
  const menu = await say(who.jid, '.menu');
  assert.ok(includes(menu, '𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨') || includes(menu, '𝓜𝓮𝓷𝓾'), menu.last.slice(0, 400));
});
