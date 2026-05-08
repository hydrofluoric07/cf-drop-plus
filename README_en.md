<p align="center"><img src="./web/public/icon.svg" width="64" alt="cf-drop logo"></p>
<h1 align="center">cf-drop</h1>
<p align="center">Private File/Text Box on Cloudflare Workers</p>
<p align="center"><a href="./README.md">中文</a> | <strong>English</strong></p>

---

## Overview

`cf-drop` is a lightweight private dropbox deployed on Cloudflare Workers. It supports text/file uploads, record browsing, file download/sharing, and password-protected access by default.
<table width="100%">
<tr>
<td>
<img src="./phone.png" width="300">
</td>
<td>

</td>
</tr>
</table>
## Quick Start

Prerequisites:

- Node.js >= 20
- pnpm >= 9
- A Cloudflare account (Worker / D1 / R2 access)

1. Install dependencies

```bash
pnpm install
```

2. Create config file (required)

```bash
# macOS / Linux
cp wrangler.toml.example wrangler.toml

# Windows PowerShell
Copy-Item wrangler.toml.example wrangler.toml
```

3. Create Cloudflare resources

```bash
npx wrangler d1 create cf-drop
npx wrangler r2 bucket create cf-drop
```

4. Edit `wrangler.toml`

- Fill in `database_id`
- Confirm `bucket_name`
- Set `PASSWORD` (secret is recommended)

```bash
npx wrangler secret put PASSWORD
```

5. Develop and deploy

```bash
# Start Worker + Web dev servers (requires wrangler.toml with valid main)
pnpm dev

# Web only
pnpm dev:web

# Build frontend assets
pnpm build

# Build + deploy Worker
pnpm deploy
```

Load locally (Chrome / Edge):

1. Open `chrome://extensions` or `edge://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `cf-drop/extension` folder

