#!/usr/bin/env bash
# 𓆩 ☕ 𓆪  VÉRSOVA · arranque en Termux (Android)
# ────────────────────────────────────────────────────────────────
#   npm run termux                 bot + panel web
#   npm run termux -- --no-web     solo el bot
#   RESTART_DELAY=10 npm run termux   espera entre reinicios (s, por defecto 5; también vale en .env)
#
# · activa `termux-wake-lock` para que Android no duerma el proceso;
# · si el bot se cae, lo vuelve a arrancar (Ctrl+C lo apaga del todo);
# · si falla 5 veces seguidas nada más arrancar, se detiene y lo avisa.
set -u

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js no está instalado. Ejecuta primero: bash scripts/termux-setup.sh"
  exit 1
fi
if [ ! -d node_modules/@whiskeysockets/baileys ]; then
  echo "✗ Faltan las dependencias. Ejecuta primero: bash scripts/termux-setup.sh"
  exit 1
fi

cleanup() {
  if command -v termux-wake-unlock >/dev/null 2>&1; then termux-wake-unlock >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if command -v termux-wake-lock >/dev/null 2>&1; then
  if termux-wake-lock >/dev/null 2>&1; then
    echo "☕ Wake lock activo: Android no dormirá el bot (verás la notificación de Termux)."
  fi
else
  echo "⚠ termux-wake-lock no está disponible: si Android duerme Termux, el bot se pausará."
fi

export VERSOVA_SUPERVISED=1
# RESTART_DELAY: de la terminal o, si no, del .env (por defecto 5 s)
env_value() { [ -f .env ] && grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | tr -d '[:space:]"' || true; }
delay="${RESTART_DELAY:-$(env_value RESTART_DELAY)}"
case "$delay" in ''|*[!0-9]*) delay=5 ;; esac
fast_fails=0
while true; do
  started=$(date +%s)
  node src/index.js "$@"
  code=$?
  # 0 = apagado limpio · 130/143 = Ctrl+C o señal de cierre
  if [ "$code" -eq 0 ] || [ "$code" -eq 130 ] || [ "$code" -eq 143 ]; then
    break
  fi
  # 3 = ya hay otra copia de VÉRSOVA en marcha: reiniciar no serviría de nada
  if [ "$code" -eq 3 ]; then
    echo "✗ Ya hay otro VÉRSOVA en marcha (¿en otra sesión de Termux?). Usa ese o ciérralo antes."
    exit 3
  fi
  if [ $(( $(date +%s) - started )) -lt 30 ]; then fast_fails=$((fast_fails + 1)); else fast_fails=0; fi
  if [ "$fast_fails" -ge 5 ]; then
    echo "✗ VÉRSOVA falló 5 veces seguidas al arrancar. Revisa el error de arriba o ejecuta: npm run doctor"
    exit "$code"
  fi
  echo "⚠ VÉRSOVA se detuvo (código $code). Reiniciando en ${delay} s… (Ctrl+C para salir)"
  sleep "$delay"
done
