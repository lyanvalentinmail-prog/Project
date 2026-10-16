#!/usr/bin/env bash
# 𓆩 ☕ 𓆪  VÉRSOVA · instalación en Termux (Android)
# ────────────────────────────────────────────────────────────────
# Uso, dentro de la carpeta del proyecto:
#
#   bash scripts/termux-setup.sh        (o: npm run termux:setup)
#
# · actualiza Termux e instala Node.js LTS, npm y git con `pkg`;
# · instala las dependencias del bot SIN compilar nada: en Android se usa
#   el SQLite integrado en Node (node:sqlite), así que better-sqlite3
#   (opcional) se omite;
# · crea el .env y pregunta tu número de owner;
# · ejecuta el diagnóstico (npm run doctor).
#
# Se puede ejecutar las veces que haga falta (también para actualizar).
# Variables: SKIP_UPGRADE=1 salta `pkg upgrade` · FORCE=1 permite usarlo fuera de Termux.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd -P)"

c_info=$'\033[36m'; c_ok=$'\033[32m'; c_warn=$'\033[33m'; c_err=$'\033[31m'; c_bold=$'\033[1m'; c_off=$'\033[0m'
say()  { printf '%s☕%s %s\n' "$c_info" "$c_off" "$*"; }
ok()   { printf '%s✓%s %s\n' "$c_ok" "$c_off" "$*"; }
warn() { printf '%s⚠%s %s\n' "$c_warn" "$c_off" "$*"; }
die()  { printf '%s✗%s %s\n' "$c_err" "$c_off" "$*" >&2; exit 1; }

printf '\n%s𓆩 ☕ 𓆪  VÉRSOVA · instalación en Termux%s\n\n' "$c_bold" "$c_off"

# ── 1. ¿Estamos en Termux? ─────────────────────────────────────────
IS_TERMUX=0
if [ -n "${TERMUX_VERSION:-}" ] || [[ "${PREFIX:-}" == *com.termux* ]]; then IS_TERMUX=1; fi
if [ "$IS_TERMUX" -ne 1 ]; then
  if [ "${FORCE:-0}" = "1" ]; then
    warn "No parece Termux: se omite la instalación de paquetes del sistema (FORCE=1)."
  else
    die "Este script es para Termux (Android). En un PC o VPS usa: npm install && npm start"
  fi
fi

# ── 2. Ubicación: el almacenamiento compartido no sirve ─────────────
# En /sdcard npm no puede crear enlaces simbólicos y SQLite no puede
# bloquear archivos ni usar WAL: el proyecto debe vivir en el HOME.
case "$ROOT" in
  /sdcard|/sdcard/*|/storage/*|/mnt/sdcard/*|/mnt/media_rw/*)
    die "El proyecto está en el almacenamiento compartido ($ROOT).
   Clónalo dentro del HOME de Termux y vuelve a intentarlo:
     cd ~ && git clone https://github.com/lyanvalentinmail-prog/Project versova
     cd versova && bash scripts/termux-setup.sh"
    ;;
esac

# ── 3. Paquetes del sistema ─────────────────────────────────────────
node_ok() {
  command -v node >/dev/null 2>&1 &&
    node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)'
}

if [ "$IS_TERMUX" -eq 1 ]; then
  if [ "${TERMUX_APP_PACKAGE_MANAGER:-apt}" = "pacman" ]; then
    say "Actualizando Termux (pacman)…"
    [ "${SKIP_UPGRADE:-0}" = "1" ] || pacman -Syu --noconfirm
    node_ok || pacman -S --needed --noconfirm nodejs-lts
    command -v npm >/dev/null 2>&1 || pacman -S --needed --noconfirm npm
    command -v git >/dev/null 2>&1 || pacman -S --needed --noconfirm git
  else
    if [ "${SKIP_UPGRADE:-0}" != "1" ]; then
      say "Actualizando los paquetes de Termux (la primera vez tarda unos minutos)…"
      pkg update -y
      pkg upgrade -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold
    fi
    if ! node_ok; then
      # sirve cualquier Node ≥ 22.13: si ya tienes la rama «nodejs» se actualiza esa
      if dpkg -s nodejs >/dev/null 2>&1; then pkg install -y nodejs; else pkg install -y nodejs-lts; fi
    fi
    # desde nodejs-lts 24.13 npm viene en un paquete aparte
    command -v npm >/dev/null 2>&1 || pkg install -y npm
    command -v git >/dev/null 2>&1 || pkg install -y git
  fi
fi

node_ok || die "Se necesita Node.js 22.13 o superior (tienes: $(node -v 2>/dev/null || echo 'ninguno')).
   Ejecuta: pkg upgrade -y && pkg install -y nodejs-lts"
command -v npm >/dev/null 2>&1 || die "npm no está instalado. Ejecuta: pkg install -y npm"
ok "Node.js $(node -v) · npm $(npm -v)"

# ── 4. Dependencias del bot ─────────────────────────────────────────
say "Instalando las dependencias del bot (sin compilar nada)…"
npm install --omit=optional --no-audit --no-fund
ok "Dependencias instaladas · base de datos con el SQLite integrado en Node"

# ── 5. Configuración (.env) ─────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  ok "Creado .env a partir de .env.example"
fi
# asegura el salto de línea final antes de añadir variables
[ -z "$(tail -c1 .env)" ] || printf '\n' >> .env

current_owner="$(grep -E '^OWNER_NUMBERS=' .env | head -n1 | cut -d= -f2- | tr -d '[:space:]"' || true)"
if [ -z "$current_owner" ] || [ "$current_owner" = "5215500000000" ]; then
  if [ -t 0 ]; then
    printf '%s?%s Tu número de WhatsApp (owner del bot) con código de país, sin + ni espacios.\n  Ej. 5215512345678 · deja vacío para configurarlo después: ' "$c_info" "$c_off"
    read -r owner || owner=""
    owner="$(printf '%s' "$owner" | tr -cd '0-9,')"
    if [ -n "$owner" ]; then
      if grep -qE '^OWNER_NUMBERS=' .env; then
        sed -i "s/^OWNER_NUMBERS=.*/OWNER_NUMBERS=${owner}/" .env
      else
        printf 'OWNER_NUMBERS=%s\n' "$owner" >> .env
      fi
      ok "OWNER_NUMBERS=${owner}"
    else
      warn "Sin owner por ahora. Edítalo cuando quieras con: nano .env"
    fi
  else
    warn "OWNER_NUMBERS sigue con el valor de ejemplo. Edítalo con: nano .env"
  fi
fi

# ── 6. Diagnóstico ──────────────────────────────────────────────────
say "Comprobando el entorno…"
if ! node scripts/doctor.js; then
  warn "El diagnóstico encontró problemas (arriba). Corrígelos antes de arrancar."
fi

cat <<EOF

${c_ok}✓ VÉRSOVA está listo en Termux.${c_off}

  ${c_bold}npm run termux${c_off}      arranca el bot y el panel (mantiene el teléfono despierto
                      y lo reinicia solo si se cae)
  ${c_bold}npm run vincular${c_off}    vincula un sub-bot con WhatsApp desde la terminal
  Panel web           http://localhost:3000  (en el navegador del teléfono)

  Consejos: instala Termux desde F-Droid o GitHub (no Play Store), desactiva la
  optimización de batería para Termux y deja su notificación activa.
  Guía completa: docs/TERMUX.md

EOF
