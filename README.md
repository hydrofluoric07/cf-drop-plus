<p align="center"><img src="./web/public/icon.svg" width="64"></p>
<h1 align="center">cf-drop</h1>
<p align="center">🗃️ Private File/Text Box — Deploy on Cloudflare Workers</p>


<table width="100%">
<tr>
<td>
<img src="./image.png" width="200">
</td>
<td>
<ul>
<li>⚡ <strong>Serverless</strong> on Cloudflare Worker</li>
<li>📱 <strong>PWA ready!</strong> for mobile</li>
<li>🔑 <strong>Password protected</strong></li>
<li>📦 <strong>Download</strong> as Tarball</li>
<li>🚚 <strong>Resumable download link</strong></li>
<li>🔗 <strong>Shareable download link</strong></li>
</ul>
</td>
</tr>
</table>

## 🚀 Quick Start

Follow these steps to get up and running quickly:

(Prerequisites: Node.js >= 20, pnpm)

```sh
pnpm install

# 1) prepare your own config file
cp wrangler.toml.example wrangler.toml

# 2) create your own Cloudflare resources
npx wrangler r2 bucket create cf-drop
npx wrangler d1 create cf-drop

# 3) edit wrangler.toml
#    - fill database_id
#    - fill bucket_name / route
#    - set PASSWORD (or use wrangler secret)

# Optional (recommended): use secret instead of plain vars
npx wrangler secret put PASSWORD

# 4) deploy
npm run deploy
```

## 👥 Multi-user Self-hosting

If this repo is published on GitHub for others to use, each user should deploy their **own** Worker:

- Each user creates their own `D1` + `R2` + domain route
- Each user fills their own `wrangler.toml`
- Each user sets their own password
- Do **not** share production `wrangler.toml` or secrets in Git

This avoids config conflicts between different users and keeps uploaded data isolated.

## 🧩 Browser Extension Version

This repo now includes an extension under `./extension` (Manifest V3):

- `popup`: embed your deployed cf-drop page directly (mobile-like view in popup)
- `options`: manage multiple Worker instances (name/baseUrl/password)
- `background`: centralized API calls + connection test

### Load extension locally (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder: `.../cf-drop/extension`

Then open extension **Settings** and add your instance:

- `baseUrl`: your deployed Worker URL (for example `https://drop.example.com`)
- `password`: your Worker password (`PASSWORD`)

## 🎨 Customize

Make `cf-drop` your own by customizing the following:

- 🔑 **Set password** via `./wrangler.toml`
- 🎨 **Change theme color** in `./web/public/manifest.json`
- 💡 **Find `database_id`** from Cloudflare Dashboard - D1 SQL page
- **Development** - `pnpm dev`
