/**
 * 𓆩 🎲 𓆪  VÉRSOVA · tests de azar y juegos (fun.service)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDice,
  rollDice,
  dado,
  moneda,
  ballAnswer,
  BALL_ANSWERS,
  bola8,
  parseOptions,
  elegir,
  encuesta,
  reverseText,
  invertir,
} from '../src/services/fun.service.js';
import { registry } from '../src/commands/index.js';
import { renderResult } from '../src/design/index.js';

const ctx = (args = '', extra = {}) => ({ args, author: { jid: '59899111222@s.whatsapp.net' }, mentions: [], ...extra });

/* ── dados ─────────────────────────────────────────────────────── */

test('parseDice acepta vacío, caras sueltas y notación NdF', () => {
  assert.deepEqual(parseDice(''), { count: 1, faces: 6 });
  assert.deepEqual(parseDice('20'), { count: 1, faces: 20 });
  assert.deepEqual(parseDice('3d6'), { count: 3, faces: 6 });
  assert.deepEqual(parseDice(' 2 D 10 '), { count: 2, faces: 10 });
});

test('parseDice rechaza valores fuera de rango o basura', () => {
  for (const bad of ['abc', '0', '1', '2d1', '99d6', '3d999', 'd6', '-5']) {
    assert.equal(parseDice(bad), null, bad);
  }
});

test('rollDice respeta los extremos según el rng inyectado', () => {
  assert.deepEqual(rollDice({ count: 3, faces: 6 }, () => 0), [1, 1, 1]);
  assert.deepEqual(rollDice({ count: 3, faces: 6 }, () => 0.9999), [6, 6, 6]);
});

test('dado devuelve la vista fun.dado con el total, y falla con formato inválido', () => {
  const out = dado(ctx('2d6'), () => 0);
  assert.equal(out.ok, true);
  assert.equal(out.view, 'fun.dado');
  assert.equal(out.data.total, 2);
  assert.equal(dado(ctx('xyz')).ok, false);
});

/* ── moneda y bola 8 ───────────────────────────────────────────── */

test('moneda cae en Cara o Cruz según el rng', () => {
  assert.equal(moneda(ctx(), () => 0.1).data.side, 'Cara');
  assert.equal(moneda(ctx(), () => 0.9).data.side, 'Cruz');
});

test('la bola 8 es estable para la misma pregunta y responde del catálogo', () => {
  const a = ballAnswer('¿Lloverá hoy?', 'semilla');
  assert.equal(a, ballAnswer('¿Lloverá hoy?', 'semilla'));
  assert.ok(BALL_ANSWERS.includes(a));
  assert.equal(bola8(ctx('')).ok, false);
  const out = bola8(ctx('¿aprobaré el examen?'));
  assert.equal(out.ok, true);
  assert.equal(out.view, 'fun.8ball');
});

/* ── elegir ────────────────────────────────────────────────────── */

test('parseOptions exige al menos 2 opciones separadas por |', () => {
  assert.deepEqual(parseOptions('pizza | sushi'), ['pizza', 'sushi']);
  assert.deepEqual(parseOptions('solo una'), []);
  assert.deepEqual(parseOptions(' a | | b | '), ['a', 'b']);
});

test('elegir devuelve una de las opciones', () => {
  const out = elegir(ctx('pizza | sushi | tacos'), () => 0);
  assert.equal(out.data.chosen, 'pizza');
  assert.equal(elegir(ctx('una sola')).ok, false);
});

/* ── encuesta ──────────────────────────────────────────────────── */

test('encuesta construye la encuesta nativa con voto único', () => {
  const out = encuesta(ctx('¿Rol esta noche? | Sí | No | Tal vez'));
  assert.equal(out.ok, true);
  assert.deepEqual(out.data.poll, { name: '¿Rol esta noche?', values: ['Sí', 'No', 'Tal vez'], selectableCount: 1 });
});

test('encuesta valida pregunta y opciones, y recorta a 12', () => {
  assert.equal(encuesta(ctx('¿Sin opciones?')).ok, false);
  assert.equal(encuesta(ctx('| a | b')).ok, false);
  const many = ['¿Pregunta?', ...Array.from({ length: 20 }, (_, i) => `op${i}`)].join(' | ');
  assert.equal(encuesta(ctx(many)).data.poll.values.length, 12);
});

/* ── invertir ──────────────────────────────────────────────────── */

test('invertir da vuelta el texto sin romper emojis', () => {
  assert.equal(reverseText('hola'), 'aloh');
  assert.equal(reverseText('a🎲b'), 'b🎲a');
  assert.equal(invertir(ctx('team')).data.reversed, 'maet');
  assert.equal(invertir(ctx('')).ok, false);
});

/* ── registro y render ─────────────────────────────────────────── */

test('los comandos nuevos están registrados y sus vistas renderizan', () => {
  for (const name of ['dado', 'moneda', '8ball', 'elegir', 'sorteo', 'encuesta', 'invertir']) {
    assert.ok(registry.get(name), `falta ${name}`);
  }
  const samples = [
    dado(ctx('3d6'), () => 0.5),
    moneda(ctx(), () => 0.2),
    bola8(ctx('¿saldrá el sol?')),
    elegir(ctx('té | café'), () => 0),
    encuesta(ctx('¿Té o café? | Té | Café')),
    invertir(ctx('versova')),
  ];
  for (const result of samples) {
    const rendered = renderResult(result);
    assert.equal(typeof rendered, 'string');
    assert.ok(rendered.length > 10, result.view);
  }
});
