<div align="center">

# Piotr Zniszczoł | Portfolio

**An interactive portfolio built around scroll-driven animation, a 3D technology helix and a custom coding-stats backend.**

[![Live site](https://img.shields.io/badge/live-piotr--zniszczol.vercel.app-0d111c?style=for-the-badge&logo=vercel&logoColor=white)](https://piotr-zniszczol.vercel.app/)

![React](https://img.shields.io/badge/React-20232a?style=flat-square&logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-0ae448?style=flat-square&logo=greensock&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0f172a?style=flat-square&logo=tailwindcss&logoColor=38bdf8)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

<!-- Main screenshot: full hero section on desktop -->
<img src="docs/screenshots/hero.png" alt="Hero section of the portfolio on desktop" width="900" />

</div>

---

## Table of contents

- [About](#about)
- [Highlights](#highlights)
  - [Cinematic intro and ambient background](#cinematic-intro-and-ambient-background)
  - [Scroll-driven text and navigation](#scroll-driven-text-and-navigation)
  - [3D technology helix](#3d-technology-helix)
  - [Interactive dock](#interactive-dock)
  - [Coding statistics](#coding-statistics)
  - [Projects showcase](#projects-showcase)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## About

This is my personal website and a playground for building interactive interfaces. It presents who I am and what I build, and combines that with motion design, 3D elements and live data from CodeTime.

The frontend is written in React and TypeScript. A Python backend built on FastAPI fetches and stores my coding statistics.

The site is available in **Polish and English**, with a language switcher that replays the text animations on change.

---

## Highlights

### Cinematic intro and ambient background

The first visit to a session opens with a short cinematic intro: light and colour emerge from darkness, then the content settles in. Behind the whole page a layered ambient background (soft glows, light rays and bokeh particles) slowly drifts.

### Scroll-driven text and navigation

The Hero and About sections reveal text word by word using GSAP SplitText. Lenis provides smooth scrolling. The interface also includes a custom cursor and a PL/EN language switch.

<!-- Screenshot: About section or the language switcher -->
<p align="center">
  <img src="docs/screenshots/about.png" alt="About section with word-by-word text reveal" width="800" />
</p>

### 3D technology helix

A Three.js scene places the tools I work with on a helix. Its motion is driven by scrolling and has a capped speed, so fast scrolling never breaks the animation. At the end of the sequence the icons fly into the dock.

<!-- Screenshot: the helix section with icons spread out -->
<p align="center">
  <img src="docs/screenshots/helix.png" alt="3D helix of technology icons built with Three.js" width="800" />
</p>

### Interactive dock

A macOS-inspired dock magnifies the icons under the cursor. Hovering shows a preview card describing the tool, inspired by the window previews on the Windows 11 taskbar.

<!-- Screenshot: dock with a preview card open -->
<p align="center">
  <img src="docs/screenshots/dock.png" alt="Dock with a magnified icon and a preview card" width="800" />
</p>

### Coding statistics

The FastAPI backend pulls data from CodeTime and stores it in Turso. The dashboard in React shows coding time, an activity heatmap and language breakdowns, with a selectable date range and a live "currently coding" status.

<!-- Screenshot: the CodeTime section -->
<p align="center">
  <img src="docs/screenshots/codetime.png" alt="CodeTime dashboard with activity heatmap and statistics" width="800" />
</p>

### Projects showcase

Projects are presented as a bento-style grid with a cinematic reveal for every card. New projects are added regularly.

<!-- Screenshot: the Projects section -->
<p align="center">
  <img src="docs/screenshots/projects.png" alt="Projects section with a bento grid of project cards" width="800" />
</p>

---

## Tech stack

| Area | Technologies |
| --- | --- |
| Interface | React, TypeScript, Vite, Tailwind CSS |
| Animation | GSAP, SplitText, Lenis |
| 3D graphics | Three.js |
| Translations | i18next |
| Backend | Python, FastAPI |
| Database | Turso / SQLite |
| Deployment | Vercel |

---

## Project structure

```text
api/        FastAPI endpoints: status, archive and recent days
scripts/    Import and sync of CodeTime data
src/        React app: sections, components, hooks and helpers, translations, icons
public/     Static assets
docs/       Screenshots used in this README
```

---

## Getting started

### Frontend

```bash
pnpm install
pnpm dev
```

### Backend

The commands below are for Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirementsDev.txt
Copy-Item .env.example .env
```

Fill in `.env`, then run:

```powershell
python scripts/seedCodetime.py
uvicorn api.index:app --reload --port 8000
```

In development the frontend proxies `/api` requests to `http://localhost:8000`.

Without the Turso variables set, the backend falls back to a local SQLite file: `local.db`.

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values you need. The `.env` file is ignored by Git.

| Variable | Description | Default / behaviour |
| --- | --- | --- |
| `CODETIME_TOKEN` | Read token for CodeTime statistics | Required |
| `TURSO_DATABASE_URL` | Turso database URL | Not set: local `local.db` |
| `TURSO_AUTH_TOKEN` | Turso access token | Required when using Turso |
| `CODETIME_TZ` | Time zone | `Europe/Warsaw` |
| `SYNC_COOLDOWN_S` | Minimum interval between syncs | `120` seconds |
| `ACTIVE_HOLD_S` | How long the "active" status is held after the last seen event | `60` seconds |

Keep tokens on the backend only. Never put them in frontend code or in the public repository.

---

## Deployment

The project is set up for Vercel:

- Vite builds the frontend.
- `api/index.py` runs as a Python serverless function.
- `vercel.json` holds the deployment configuration (API rewrite and asset cache headers).
- Environment variables are set in the Vercel project settings.

---

## Roadmap

- Seasonal ambient backgrounds: spring, summer, autumn and winter.
- New projects added to the Projects section roughly every two weeks, so the portfolio stays fresh.
