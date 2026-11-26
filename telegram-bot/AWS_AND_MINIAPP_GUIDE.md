# Ondine + AloneMusic Bot: Mini App Button & Amazon AWS Guide

## 1. Telegram Bot me Mini App Button Kaise Lagayein (@BotFather)
Telegram Mini App sirf **HTTPS** domain par khulti hai:

1. Telegram par **@BotFather** open karein.
2. `/setmenubutton` bhejein -> apna bot select karein -> apna HTTPS URL dalein (e.g., `https://music.yourdomain.com`) -> button title `🎧 Mini App` rakhein.
   *(Note: Hamara bot startup par bhi `set_chat_menu_button` automatically set karta hai jab `MINI_APP_URL` set ho.)*
3. **Group VC "Advanced Music Control" Direct Link** ke liye:
   - `@BotFather` par `/newapp` chalayein -> apna bot select karein -> Title: `Ondine` -> Short Name (e.g., `ondine`) -> Web App URL: `https://music.yourdomain.com`.
   - Phir `telegram-bot/.env` me set karein:
     ```env
     MINI_APP_URL=https://music.yourdomain.com
     MINI_APP_SHORT_NAME=ondine
     MINI_APP_SERVER_URL=http://127.0.0.1:3000
     BOT_BRIDGE_SECRET=koi_bhi_strong_random_secret
     ```
   - Ab group me gana bajne par neeche **🎛️ Advanced Music Control** dabane par URL `https://t.me/<BotUsername>/ondine?startapp=vc_<chat_id>` direct Mini App launch karega!

## 2. Admin-Only Group VC Security Kaise Kaam Karti Hai
- Jab group me koi user **🎛️ Advanced Music Control** dabata hai, Telegram `initData` (signed by `BOT_TOKEN`) + `start_param=vc_<chat_id>` bhejta hai.
- Server `server.ts` HMAC-SHA256 se `initData` verify karta hai aur Telegram Bot API `getChatMember(chat_id, user_id)` se check karta hai ki user us exact group ka `creator` ya `administrator` hai ya nahi.
- Agar admin nahi hai, toh VC buttons locked rehte hain (`403 Forbidden`) aur user sirf apni device par **Personal Stream** sun sakta hai.
- Alag-alag groups ke VC rooms `chat_id` ke hisaab se bilkul isolated chalte hain.

## 3. Amazon AWS EC2 Deployment Steps
1. AWS EC2 Console me **Ubuntu 22.04 / 24.04 LTS** (`t3.small` ya `t3.medium`, 20GB SSD) launch karein.
2. **Security Group Inbound Rules**: Ports `22` (SSH), `80` (HTTP), `443` (HTTPS) allow karein.
3. EC2 par SSH karke repo clone karein aur run karein:
   ```bash
   git clone <your-repo-url> ~/ondine-music
   cd ~/ondine-music
   bash telegram-bot/deploy/aws-setup.sh
   ```
4. Dono `.env` files (`~/ondine-music/.env` aur `~/ondine-music/telegram-bot/.env`) me apne keys bharein (`BOT_TOKEN`, `API_ID`, `API_HASH`, `STRING_SESSION`, `MONGO_DB_URI`, `LOGGER_ID`, `MUSIC_API_KEY`, `BOT_BRIDGE_SECRET`).
5. **Nginx + Free SSL (Let's Encrypt)** lagayein taaki Telegram HTTPS accept kare:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   # /etc/nginx/sites-available/ondine me proxy_pass http://127.0.0.1:3000 + WebSocket Upgrade lagayein
   sudo certbot --nginx -d music.yourdomain.com
   ```
6. Systemd services start karein:
   ```bash
   sudo cp telegram-bot/deploy/ondine-miniapp.service /etc/systemd/system/
   sudo cp telegram-bot/deploy/ondine-bot.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now ondine-miniapp ondine-bot
   ```
