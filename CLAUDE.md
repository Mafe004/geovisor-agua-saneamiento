# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a **Turborepo monorepo** (npm workspaces) for a thesis project (GeoVisor de Agua y Saneamiento — Zipaquirá, Cundinamarca):

- `backend/` — FastAPI + MySQL REST API (Python)
- `frontend/` — React Native + Expo mobile app (consumes the backend API over HTTP)

Previously these lived as separate branches (`backend`, `frontend`) of the same repo, checked out via `git worktree` into sibling folders. That history is preserved (`git log -- backend/`, `git log -- frontend/` both go all the way back) but the branches themselves are no longer the working structure — everything now lives together on `main`. `backend/` isn't an npm package; it has a minimal `package.json` purely so Turborepo can drive it (`dev`, `lint`, `lint:fix`) alongside the frontend.

### Common commands (run from repo root)

```bash
npm install              # installs both workspaces; also create backend/.venv separately (below)
npx turbo run lint       # lint both backend (ruff) and frontend (eslint)
npx turbo run lint:fix   # autofix both
npm run dev:backend      # -> uvicorn, requires backend/.venv active
npm run dev:frontend     # -> expo start
```

There is no configured test suite for either package.

---

## Backend — `backend/`

### Commands

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows; .venv/bin/activate elsewhere
pip install -r requirements-dev.txt                  # requirements.txt + ruff
cp .env.example .env                                 # then fill DB_* and SECRET_KEY

uvicorn main:app --reload --host 0.0.0.0 --port 8000  # dev server
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4  # production-style

python -m ruff check .          # lint
python -m ruff check --fix .    # autofix
python -m ruff format .         # format

curl http://localhost:8000/health
# Swagger docs: http://localhost:8000/docs

python tools_hash.py            # print a PBKDF2 hash (e.g. to manually patch a user row)
```

Ruff config lives in `backend/pyproject.toml`. `B008` (function calls in argument defaults) is deliberately ignored — `= Depends(...)` in a route signature is FastAPI's intended DI pattern, not a bug.

The database schema/data lives in `backend/geovisor_backup_limpio.sql` (import with `mysql -u root -p < geovisor_backup_limpio.sql`).

### Architecture

Monolithic, modular-by-router FastAPI app — no ORM, raw `PyMySQL` with `DictCursor` everywhere (see `app/db/database.py`). Each business domain gets one router file under `app/routers/`, all mounted in `main.py` in a fixed order (CORS middleware must stay registered *before* routers — see the comments in `main.py`).

```
backend/app/
├── core/
│   ├── security.py   ← password hashing (passlib, pbkdf2_sha256 — NOT bcrypt, chosen for Windows/py3.13 stability) + JWT encode/decode
│   └── deps.py        ← get_current_user / require_active_user / require_roles(*ids) — FastAPI dependency chain for auth
├── db/database.py     ← get_connection() -> new pymysql connection per call, autocommit=True
└── routers/            ← one file per domain: auth, usuarios, entidades, reportes, catalogos, historial, notificaciones, infraestructura, auditoria
```

**Auth/authorization flow:** `POST /auth/login` issues a JWT (HS256, `sub`=user id). Protected endpoints depend on `require_roles(...)` from `app/core/deps.py`, which chains `get_current_user` (decodes JWT, re-fetches the user row from MySQL) → `require_active_user` (checks `id_estado_cuenta == 1`) → role check against `id_rol`. There's no ORM session/cache — every authenticated request re-queries the `usuarios` table.

**Roles** (`id_rol`): 1 CIUDADANO, 2 ENTIDAD, 3 MODERADOR, 4 ADMINISTRADOR. Most read endpoints are open to all authenticated roles but filter results by role/ownership inside the handler (e.g. `GET /reportes/` returns different rows depending on who's asking) rather than via separate routes.

**Account states** (`id_estado_cuenta`): 1 ACTIVO, 2 INACTIVO, 3 SUSPENDIDO, 4 PENDIENTE (new registrations start here and need admin activation).

Config is env-driven via `python-dotenv` (`DB_HOST/PORT/USER/PASSWORD/NAME`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`) — see `backend/.env.example`. Never commit a real `.env`.

⚠️ **Known issue, not yet fixed:** `main.py` sets `allow_origins=["*"]` together with `allow_credentials=True` in `CORSMiddleware` — browsers reject that combination for credentialed requests, and it's an anti-pattern even where it does work. If touching CORS, prefer an explicit origin allowlist. `SECRET_KEY` also silently falls back to `"CHANGE_ME_PLEASE"` in `app/core/security.py` if unset rather than failing startup — worth hardening before any real deployment.

---

## Frontend — `frontend/`

### Commands

```bash
cd frontend       # or use the root npm scripts (dev:frontend, lint) which target this workspace
npx expo start          # or: npm run start / android / ios / web
npx expo lint            # eslint (eslint-config-expo, flat config in eslint.config.js)
npx expo lint -- --fix
```

**Before writing Expo-related code**, note `AGENTS.md` in this directory instructs: *"Expo HAS CHANGED — read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code."* This project pins Expo ~54; don't rely on older/newer Expo API assumptions from training data.

**Backend URL is hardcoded for LAN dev**, not env-driven: edit `DEV_IP` in `src/api/client.js` to your machine's LAN IP (phone can't reach `localhost`). This is the #1 source of `ERR_CONNECTION_TIMED_OUT` during dev.

**`react`/`react-dom` version overrides live in the root `package.json`**, not `frontend/package.json` — npm workspaces ignore a workspace-level `overrides` field, so if `react-native-web`'s peer-dependency resolution ever needs adjusting again, edit the root file.

### Architecture

Feature-organization is **by user role**, mirroring the backend's role model — this is the key structural fact to know before touching `src/screens/`:

```
frontend/src/
├── api/
│   ├── client.js      ← axios instance: baseURL from DEV_IP, JWT request interceptor (reads AsyncStorage 'token'), 401 response interceptor (clears session)
│   └── services.js    ← per-domain API functions (authAPI, reportesAPI, usuariosAPI, ...)
├── context/AuthContext.js  ← global auth state (user, token, login/logout); validates stored token via /auth/me on boot
├── navigation/AppNavigator.js ← root switch: Loading → Auth stack → role-specific tab navigator, keyed on user.id_rol (1 Ciudadano, 2 Entidad, 3 Moderador, 4 Administrador)
├── components/         ← cross-role reusable UI (GradientHeader, MapaWebView, ReportCard, StatCard, StatusBadge, LoadingScreen)
├── screens/{auth,ciudadano,entidad,moderador,admin,shared}/  ← screens live under their role's folder; shared/PerfilScreen is used by every role
└── theme/colors.js     ← design tokens (blue→teal gradient, per-status colors)
```

Adding a screen/feature for one role should not touch other roles' folders — that's the point of the structure. `AppNavigator.js` is the single place that wires `id_rol` → which tab navigator + shared stack screens (e.g. `DetalleReporteScreen`) mount. Every screen imported in `AppNavigator.js` needs an actual `<Tab.Screen>`/`<Stack.Screen>` entry to be reachable — nothing renders it automatically just because the file exists and is imported.

The map (`MapaWebView.js`) is Leaflet/OpenStreetMap rendered inside a `react-native-webview`, not a native map view — Google Maps is only used if an API key is configured in `app.json` (optional).
