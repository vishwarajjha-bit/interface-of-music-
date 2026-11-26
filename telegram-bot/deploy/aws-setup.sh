#!/usr/bin/env bash
set -euo pipefail

# Amazon AWS EC2 (Ubuntu 22.04 / 24.04) Automated Bootstrap for Ondine Mini App + AloneMusic Bot
echo "==> Updating apt packages and installing system dependencies (ffmpeg, python3, git, nginx)..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip ffmpeg git curl nginx unzip

echo "==> Installing Node.js 22 LTS..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Installing uv (fast Python dependency manager)..."
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOT_DIR="$APP_ROOT/telegram-bot"

echo "==> Installing Ondine Web + Mini App Backend dependencies in $APP_ROOT..."
cd "$APP_ROOT"
npm install --legacy-peer-deps
npm run build

echo "==> Setting up Python virtual environment for AloneMusic Bot in $BOT_DIR..."
cd "$BOT_DIR"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install . yt-dlp --upgrade

echo "==> Setup complete!"
echo "Next steps:"
echo "  1. Copy .env.example -> .env in $APP_ROOT and fill BOT_TOKEN, MUSIC_API_KEY, BOT_BRIDGE_SECRET."
echo "  2. Copy sample.env -> .env in $BOT_DIR and fill API_ID, API_HASH, BOT_TOKEN, LOGGER_ID, MONGO_DB_URI, STRING_SESSION, MUSIC_API_KEY, MINI_APP_URL, MINI_APP_SERVER_URL, BOT_BRIDGE_SECRET."
echo "  3. Start both services via systemd (see deploy/ondine-miniapp.service & deploy/ondine-bot.service) or tmux."
