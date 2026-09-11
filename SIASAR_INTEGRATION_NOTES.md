# SIASAR integration notes

Branch: `feature/siasar`. This file is updated as work progresses; see
"Decisions and deviations" for anything that departs from the task spec, and
"Open questions" for anything left for a human to confirm.

## Conventions found (Phase 0)

**Router registration** — `backend/main.py`: CORS middleware is added first,
then every router via `app.include_router(...)`, in a fixed list right after
the middleware block, each imported as `from app.routers.X import router as
X_router` (except `auditoria`, imported as a module). New routers append to
that list. `siasar_router` is added after `entidades_router`, before
`auditoria.router`.

**Connection / transactions** — `backend/app/db/database.py`:
`get_connection()` returns a connection from a `PooledDB` pool
(`autocommit=True`, `DictCursor`, DECIMAL columns converted to `float` at the
driver level). Read-only handlers use `get_connection()` directly. Any
handler that writes more than one table (or writes a business table plus an
audit row) uses the `transaccion()` context manager instead: it calls
`conn.begin()`, yields a cursor, commits on clean exit, rolls back on any
`Exception` (including `HTTPException`), and always closes the connection
(returning it to the pool) in `finally`. This is the exact pattern the SIASAR
importer's single transaction and the report-creation linking step reuse —
no new transaction helper is written.

**Auth** — `backend/app/core/deps.py`: `get_current_user` decodes the JWT,
re-fetches the user row from `usuarios` (no session cache), and returns a
dict with `id_usuario, id_rol, id_estado_cuenta, id_entidad, ...`.
`require_active_user` wraps it and additionally requires
`id_estado_cuenta == EstadoCuenta.ACTIVO`. `require_roles(*roles)` wraps
`require_active_user` and 403s if `id_rol` isn't in the given set. Roles
(`app/core/roles.py`, `IntEnum`): `CIUDADANO=1, ENTIDAD=2, MODERADOR=3,
ADMIN=4` (the enum member is `ADMIN`, not `ADMINISTRADOR`). All SIASAR
endpoints use `Depends(require_active_user)` except `resumen-municipios`,
which uses `Depends(require_roles(Rol.MODERADOR, Rol.ADMIN))`.
`app/core/policies.py` holds row/query-scoping helpers
(`scope_reportes`, `puede_ver_reporte`, `puede_cambiar_estado`) — pure
functions over plain dicts, no DB/HTTP imports except `HTTPException` for the
two cases that were already a 403 (ENTIDAD with no `id_entidad`, unknown
role). No SIASAR-specific policy function is needed: every SIASAR endpoint is
open to any active user except the ADMIN/MODERADOR-gated summary, which uses
`require_roles` directly, matching `infraestructura.py`'s write endpoints.

**Router shape** — `backend/app/routers/reportes.py` (601→672 lines,
already modified this session to add `asignar_entidad`): request models are
declared inline in the router file (`ReporteCreateRequest`,
`CambiarEstadoRequest`, `AsignarEntidadRequest`), not in `schemas/`; response
models live in `app/schemas/<router>.py` and are always Pydantic `BaseModel`
with `model_config = ConfigDict(from_attributes=True)` when built from a SQL
row dict. Every route declares `response_model=`. Handlers open
`get_connection()` (read) or `with transaccion() as cursor:` (write), wrap
the body in `try/except HTTPException: raise / except Exception as e:
handle_db_error(e)`, and `finally: conn.close()` for the read path
(`transaccion()` closes its own connection). Static routes (`/mapa`,
`/estadisticas`) are declared before `/{id_reporte}` — the file has an
explicit comment warning about this. `siasar.py` follows the same shape:
`/municipios`, `/comunidades/mapa`, `/sistemas/mapa`,
`/resumen-municipios`, `/cercana` before `/comunidades/{id_siasar}` and
`/sistemas/{id_siasar}`.

**Audit log** — `backend/app/core/audit.py`: `Modulo` and `Accion` are
`str, Enum`. `registrar_auditoria(cursor, *, id_usuario: int | None, accion:
Accion, modulo: Modulo, ip: str | None)` inserts into `logs_auditoria
(id_usuario, accion, modulo, ip_origen, fecha_accion)` using the caller's
open cursor — never opens its own connection, so a rollback reverts the log
row with everything else. `id_usuario` is nullable (`ON DELETE SET NULL`),
which is what the importer uses (no HTTP user; `id_usuario=None`). Added:
`Modulo.SIASAR = "SIASAR"`, `Accion.IMPORTACION = "IMPORTACION"`.

**Schema management** — no migrations folder exists; the *only* source of
truth for both the dev DB and the test DB is `backend/geovisor_backup_limpio.sql`
(a single executable dump: `DROP TABLE IF EXISTS` + `CREATE TABLE` +
`INSERT` per table, all tables `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci`). `backend/tests/conftest.py`'s session-scoped
`_seed_snapshot` fixture drops and recreates `geovisor_test` by executing
this dump verbatim, then snapshots every table listed in its `TABLES` list;
an autouse `_reseed` fixture truncates + reinserts that snapshot before every
test. Per the task's instruction ("If the project has no migration
mechanism, create `backend/migrations/`"): a numbered-SQL-file migrations
folder is added for applying to an *existing* dev/prod database without
re-running the whole dump, **and** the dump itself is updated with the new
tables/columns (empty, since real SIASAR rows come only from the import
script — never baked into the dump) so `conftest.py` keeps working
unchanged except for one line: the new `siasar_*` table names are appended
to `TABLES` (as empty tables — SIASAR test data is loaded by a dedicated
fixture that runs the real importer against small fixture CSVs, see Phase 1
tests).

**Tests** — `backend/tests/` integration suite, `TestClient(app)`, one
`client_<rol>` fixture per role (real login against seeded demo accounts),
plus `client_anon`. `tests/conftest.py` hard-refuses to run unless
`DB_NAME` ends in `_test` (`tests/.env.test`). `test_authz.py` holds the
role×endpoint permission matrix; `test_contracts.py` holds hardcoded
response-field-set snapshots (`EXPECTED_REPORTE_DETALLE_FIELDS` etc.) that
must be updated whenever a response model's fields change — this is a
deliberate drift guard, not a bug, per this repo's established pattern
(already touched once this session for `id_entidad_sugerida`/
`entidad_sugerida`). `pytest.ini`/`pyproject.toml` marks integration tests
with `pytestmark = pytest.mark.integration`.

**Frontend** — TypeScript (`frontend/tsconfig.json` present, strict). No
TanStack Query installed (checked `package.json`) — Phase 3/4 data-fetching
follows the existing manual `useState`/`useEffect`/`useFocusEffect` +
`try/catch/finally` pattern used by every other screen. API client:
`src/api/client.ts` (axios instance, JWT interceptor); services:
`src/api/services.ts`, one object per domain (`reportesAPI`, `entidadesAPI`,
...) — `siasarAPI` is added there. Types are generated from the live
OpenAPI schema into `src/types/api.d.ts` via `npm run gen:api`
(`openapi-typescript`), then hand-aliased in `src/types/domain.ts` — SIASAR
response shapes follow the same generate-then-alias flow, never hand-typed.
Map: `MapaWebView.tsx` (native, `react-native-webview`) and
`MapaWebView.web.tsx` (web, `<iframe>`) both call the single shared
`buildMapHtml()` in `src/components/mapHtml.ts`, which embeds Google Maps JS
(confirmed via `google.maps.Map`/`google.maps.Marker` — **the frontend
README's claim of Leaflet/OpenStreetMap is stale and is corrected in Phase
3**). Screens rendering `MapaWebView`: `ciudadano/MapaScreen.tsx` (the only
full-screen interactive map with layer controls — this is where SIASAR
layer toggles go), `ciudadano/CrearReporteScreen.tsx` (center-pin picker,
reused by Entidad), `entidad/DetalleReporteScreen.tsx` and
`moderador/InfraestructuraScreen.tsx` (small read-only maps, no layer
toggles needed). Report creation: `ciudadano/CrearReporteScreen.tsx`
(shared by Entidad via role-aware nav, added earlier this session). Entity/
moderator report detail: `entidad/DetalleReporteScreen.tsx` (shared by both
roles; already role-branches its rendering this session between a "classic"
view for Ciudadano/Admin and an "Andi" view for Entidad — the SIASAR
diagnostic card is added to both branches, since both show report detail).
Admin dashboard: `admin/DashboardScreen.tsx`. Theme/colors:
`src/theme/colors.ts` (existing blue theme, used by Ciudadano/Admin) and
`src/theme/andi.ts` (added earlier this session for Moderador/Entidad) —
SIASAR presentation constants (ratings, test-result labels, chlorination
labels, source-line helper) go in a new `src/theme/siasar.ts` so they don't
belong to either role-specific palette and are reusable from both the map
screen (Ciudadano-themed) and the entity/moderator detail card
(Andi-themed).

**Report states** (`estado_reporte` seed, confirmed in
`geovisor_backup_limpio.sql`): `PENDIENTE(1), EN_REVISION(2), EN_PROCESO(3),
RESUELTO(4)`. There is no `RECHAZADO` row in the actual seed data (the task
brief's "expected" list includes it, and `fuente_reporte` and some code
comments mention it defensively, but the catalog table itself only ships
those four). "Open" for `resumen-municipios.reportes_abiertos` is
implemented as written in the spec (`estado NOT IN ('RESUELTO',
'RECHAZADO')`) — harmless if `RECHAZADO` never occurs, and forward-
compatible if it's added later without code changes.

**`infraestructura_hidrica` SIASAR placeholders** (exact seed rows,
`fuente = 'SIASAR'`): id 1 `Planta de Tratamiento Central` (tipo `PTAR`) and
id 4 `Pozo de Abastecimiento Sur` (tipo `POZO`). Both are removed (dump,
migration, and live dev DB) in Phase 1 — see "Removed placeholder rows".
