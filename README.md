<div align="center">
  <img src="public/logo.png" width="140" height="140" alt="Da Vinci" />
  <h1>Da Vinci</h1>
  <p><b>An invitation-only atelier for the devoted student of the anime, manhwa &amp; light-novel arts.</b></p>

  <p>
    <a href="https://www.dathevinci.xyz"><img src="https://img.shields.io/badge/live-dathevinci.xyz-a855f7?style=for-the-badge&logo=vercel&logoColor=white" alt="Live site"></a>
    <a href="https://github.com/Dathevinci/da-vinci-frontend/releases/latest"><img src="https://img.shields.io/badge/Android-Download_APK-3ddc84?style=for-the-badge&logo=android&logoColor=white" alt="Download the Android app"></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16">
    <img src="https://img.shields.io/badge/React_19-149ECA?logo=react&logoColor=white" alt="React 19">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Tailwind_4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
    <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white" alt="Prisma">
    <img src="https://img.shields.io/badge/Postgres-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  </p>
</div>

---

**Da Vinci** is a cinematic, community-driven library for three worlds — **anime**, **manhwa**, and **light novels** — behind a single invitation-only door. Track what you watch and read, earn a community currency for taking part, and spend it on animated profile cosmetics that range from a subtle glow to a screen-consuming, SSS-grade domain expansion.

## ✦ Three modes, one atelier

The whole app re-skins itself around the world you're in — accent, navigation, and library all shift.

| | Mode | What's inside |
|:--:|---|---|
| 🟣 | **Anime** | AniList-powered discovery, embedded trailers, an airing schedule down to the second, and personal watchlist tracking. |
| 🔴 | **Manhwa** | Browse and read chapters in-app, with per-chapter progress saved to your profile. |
| 🩷 | **Novels** | A scraped light-novel library with a fully customizable reader — 5 themes, 7 reading fonts, adjustable size, spacing, width, and justification. |

## ✦ Features

- **✧ Arise Points economy** — earn the community currency for watching, reading, tracking titles, commenting, and following. Every payout is whitelisted and de-duplicated server-side, so the leaderboard stays honest.
- **The Shop** — spend points on animated **avatar frames** and full-profile **effects**, from common sparkles up to hand-tuned **SSS-grade cinematics** (Infinite Void, Temporal Echo, …) and **limited-time drops** with live countdowns.
- **Profiles** — levels and ranks, badges, live watch/read stats, and your equipped cosmetics playing across the whole card.
- **Community** — a global activity feed, discussion threads on individual anime / manhwa / novels, following, and direct messages.
- **Supporter perks** — a Ko-fi integration grants a Supporter badge and bonus points.
- **Signed identity** — JWT-backed sessions gate every sensitive action.

## 📱 Da Vinci for Android

A **Trusted Web Activity**: a tiny (~2.7 MB) native shell that opens the live site fullscreen with no browser bar — so it **updates itself** on every deploy, no reinstall needed.

**[⬇ Download the latest APK](https://github.com/Dathevinci/da-vinci-frontend/releases/latest)** &nbsp;·&nbsp; built and signed automatically by GitHub Actions on every `v*` tag — see [`android/`](android/README.md).

## 🛠 Built with

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion, and hand-written HTML5 Canvas for the profile effects. Deployed on **Vercel**.
- **Backend** — Express + Prisma over a **Neon** PostgreSQL database, hosting the social graph, economy, and auth. Deployed on **Render**. *(repo: `da-vinci-backend`)*
- **Data** — AniList GraphQL v2 for anime; server-side scrapers for the manhwa and light-novel libraries.

## 🚀 Local development

```bash
npm install
npm run dev        # → http://localhost:3000
```

Point `NEXT_PUBLIC_API_URL` at your running `da-vinci-backend` instance. The library itself sits behind the invitation gate.

<div align="center">
  <br/>
  <sub>Crafted by <b>Dejavuh</b> · <a href="https://www.dathevinci.xyz">dathevinci.xyz</a></sub>
</div>
