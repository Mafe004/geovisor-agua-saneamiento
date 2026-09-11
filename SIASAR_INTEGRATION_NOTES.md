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

## Decisions and deviations (Phase 1)

- **Migrations folder**: created `backend/migrations/` (numbered SQL +
  `run_migrations.py` + `README.md`) per the task's own fallback
  instruction, since no migration mechanism existed. It tracks applied
  files in a new `schema_migrations(filename, applied_at)` table (plain
  table, not a stored procedure) rather than embedding
  `information_schema` guards inside the SQL files themselves — simpler,
  and the SQL files stay ordinary DDL that also gets copied verbatim into
  `geovisor_backup_limpio.sql` for fresh/test databases. Applied
  successfully to both a from-scratch test DB and the existing dev DB
  (idempotency re-verified: a second `run_migrations.py` run reports
  nothing pending).
- **Audit row "details with counts"**: `logs_auditoria` has no free-text
  column (`id_log, id_usuario, accion, modulo, fecha_accion, ip_origen`)
  and constraint 5 says reuse `registrar_auditoria`/the existing table as-is
  rather than duplicating/extending it for one feature. The audit row
  (`accion=IMPORTACION, modulo=SIASAR, id_usuario=NULL`) records *that* an
  import ran and *when*; the actual counts live in the run's stdout report
  and in this file's "Last import report" section, not in the audit table.
- **`id_usuario` for the audit row**: the importer runs outside any HTTP
  request (CLI script), so there's no authenticated user — `id_usuario=None`
  is passed, which `logs_auditoria.id_usuario` already allows (nullable,
  `ON DELETE SET NULL`, same as any user later being deleted).
- **Matching-key normalization** (`_clave()`): interpreted "collapse
  whitespace, strip spaces, periods and single or double quotes" as
  *removing* those characters entirely (not just trimming the ends) after
  the NFKD/uppercase step — e.g. `"Sistema  Unión"` and `"SISTEMA UNION"`
  both reduce to `SISTEMAUNION`. This is what makes the accent/double-space
  fixture case (`test_enlaces_comunidad_sistema`) actually match, and is
  the only reading under which "collapse whitespace" (step N) and "strip
  spaces" (step N+1) aren't the same no-op step twice.
- **`distancia_siasar_m` on cascade delete**: `fk_reportes_siasar`'s
  `ON DELETE SET NULL` only clears `id_siasar_comunidad` (the FK column
  itself) — MySQL has no way to also null a sibling column via the FK
  clause. Found via `test_borrar_comunidad_vinculada_pone_null_en_el_reporte`:
  without a fix, a report whose community got deleted kept a stale
  `distancia_siasar_m` pointing at nothing. Fixed in the importer's own
  transaction: right after the delete step, `UPDATE reportes SET
  distancia_siasar_m = NULL WHERE id_siasar_comunidad IS NULL AND
  distancia_siasar_m IS NOT NULL` runs before the backfill step, so a
  freshly-orphaned report either gets both fields cleared together or both
  re-populated together by backfill (never a mismatched pair).
- **Unparseable non-empty numeric values**: the spec only defines explicit
  reject-row behavior for invalid coordinates/dates. A non-empty value in a
  numeric column (`poblacion`, `pob_servida`, ...) that `Decimal()` can't
  parse is treated as `NULL` for that field (row still imported) rather
  than rejecting the whole row — no such value exists in the real
  Cundinamarca CSVs (verified: the full import reports 0 rejected rows
  beyond the department/coordinate filters), so this path is defensive,
  not exercised by real data.
- **RECHAZADO**: `estado_reporte`'s actual seed only has PENDIENTE,
  EN_REVISION, EN_PROCESO, RESUELTO — no RECHAZADO row exists today. The
  `resumen-municipios` "open reports" definition (`estado NOT IN
  ('RESUELTO','RECHAZADO')`) is implemented as specified anyway: harmless
  now, forward-compatible if that state is added later.

## Schema changes and how to apply them

New tables `siasar_comunidad`, `siasar_sistema`, `siasar_comunidad_sistema`;
additive columns `reportes.id_siasar_comunidad` /
`reportes.distancia_siasar_m`; two placeholder rows removed from
`infraestructura_hidrica`. Defined in two places kept in sync by hand (small
schema, no tooling needed to auto-sync them):

- **Fresh / test databases**: already baked into
  `backend/geovisor_backup_limpio.sql` — nothing to run manually.
  `tests/conftest.py` picks it up automatically (its `TABLES` list now
  includes the three new tables, as empty tables truncated/reseeded like
  everything else — real SIASAR rows only ever come from the importer, in
  a dedicated fixture per test, never from the dump).
- **Existing databases** (dev today, or anything already deployed):
  ```bash
  cd backend
  python migrations/run_migrations.py --dry-run   # see what's pending
  python migrations/run_migrations.py             # apply it
  ```
  Verified against both an empty freshly-created database (via the dump)
  and the live dev database (`geovisor_agua_saneamiento`, which already had
  5 reports and the 2 placeholder infra rows before migrating) — in both
  cases the schema ends up identical and a second `run_migrations.py`
  reports nothing pending.

## How to re-import SIASAR

From `backend/`, with the venv activated:

```bash
python -m scripts.importar_siasar --dir data/siasar --dry-run   # preview, writes nothing
python -m scripts.importar_siasar --dir data/siasar             # real import
python -m scripts.importar_siasar --dir data/siasar --allow-shrink   # only if a file legitimately shrank >50%
```

Runs inside one transaction (upsert → rebuild links → delete stale rows →
backfill `reportes` → one audit row → commit; any failure rolls back
everything, including the audit row). Safe to re-run any time SIASAR
publishes updated CSVs — it's a full upsert/sync each time, not additive.

## Last import report

Real run against `backend/data/siasar/{community_main,system_main}.csv`
(3,644 / 926 data rows), against the dev database:

```
Comunidades leídas: 3644
  insertadas: 3644  actualizadas: 0  eliminadas: 0  atípicas: 1
Sistemas leídos: 926
  insertados: 926  actualizados: 0  eliminados: 0  atípicos: 1
Enlaces comunidad<->sistema creados: 3187
  nombres sin enlazar: 159
  nombres ambiguos: 0
Reportes vinculados de vuelta (backfill): 4
```

Second run immediately after (idempotency check):

```
Comunidades leídas: 3644
  insertadas: 0  actualizadas: 3644  eliminadas: 0  atípicas: 1
Sistemas leídos: 926
  insertados: 0  actualizados: 926  eliminados: 0  atípicos: 1
Enlaces comunidad<->sistema creados: 3187
  nombres sin enlazar: 159
  nombres ambiguos: 0
Reportes vinculados de vuelta (backfill): 0
```

0 rows rejected in either run (no coordinate/date/department failures on
the real Cundinamarca-filtered data — expected, since the source file is
already filtered to Cundinamarca and SIASAR's own coordinates are all
sane). 1 atypical community, 1 atypical system — matches the two rows
`SIASAR_Cundinamarca_CSV/LEEME.txt`'s source data facts called out by ID
(community `ROSARIO, LA VEGA`; system `LA VEGA`). 3,187 linked pairs is
close to the spec's "about 3,190" estimate (small differences are expected
— "about" — and don't indicate a matching bug: every fixture-based
correctness test in `test_importar_siasar.py` passes, including the
zero-ambiguous-matches assertion).

## Data caveats for the thesis

- **Rural areas only.** SIASAR surveys rural communities (veredas) and
  their water systems — it does not cover urban water service, which in
  Zipaquirá and most Cundinamarca municipalities is a separate, typically
  better-documented utility. A municipality with 0 SIASAR communities may
  still have a large urban population with normal water service; SIASAR's
  silence there is not evidence of anything.
- **Survey dates span 2017–2022** (`fecha_encuesta` ranges from
  2017-11-02 to 2022-05-18 in the source). Every SIASAR view must show this
  date — it is a historical diagnostic, not a live status.
- **No validation date in the source.** SIASAR's own schema has a
  `fecha_validacion` column; it's blank for essentially all Cundinamarca
  rows in this export and is therefore not imported. Only
  `fecha_encuesta` (survey date) is available and shown.
- **Link rate ≈ 95%** (3,187 of ~3,352 attempted community→system name
  matches). The remaining ~5% (159 names in the real run) are communities
  whose `sistemas` text didn't resolve to exactly one system in the same
  municipality — logged, never guessed. A community with no linked system
  is not necessarily unserved; it may mean the system name in the source
  data doesn't match cleanly (typo, different punctuation not covered by
  the normalization rules, or the system genuinely isn't in this export).
- **Atypical rows** (`poblacion_atipica` / an atypical system's population
  flag): `poblacion_atipica=1` flags a population/household ratio SIASAR
  itself reports as implausible (`población > viviendas × 15`). The number
  is stored exactly as published — never corrected or dropped — the flag
  just tells the UI to show "dato por verificar" instead of presenting it
  as reliable.
- **`SIN_PRUEBA`/`"No aplica"` means no registered test**, not "passed" or
  "failed" — a system with `prueba_coliformes = SIN_PRUEBA` was never
  tested (or the test result wasn't recorded), which is a data gap, not a
  water-quality finding. Every UI label says exactly this ("Sin prueba
  registrada" / "Última prueba registrada: ..."), and constraint 9 bans
  the words "potable"/"no potable" anywhere near this data for the same
  reason: SIASAR's own indicators don't certify potability, only report
  survey answers.

## Removed placeholder rows

Two fictional seed rows in `infraestructura_hidrica` claimed
`fuente = 'SIASAR'` without ever coming from real SIASAR data (the app had
no SIASAR integration before this feature — they were made-up demo
content): id 1 `Planta de Tratamiento Central` (`PTAR`) and id 4 `Pozo de
Abastecimiento Sur` (`POZO`). Removed from `geovisor_backup_limpio.sql`,
from `migrations/0001_siasar_schema.sql`, and from the live dev database.
The other three seed rows (`Acueducto Norte Zipaquirá` / CAR, `Embalse del
Neusa` / CAR, `Red Alcantarillado Centro` / Municipio) are untouched — they
were never attributed to SIASAR. `backend/tests/test_contracts.py`'s
`test_get_infraestructura_detalle` was pointed at id 2 instead of the now
-gone id 1.

## Decisions and deviations (Phase 2)

- **`FUENTE_ATRIBUCION` lives in `app/services/siasar.py`**, not duplicated
  in `schemas/siasar.py` or the router — it was originally (unused) dead
  code in the importer; moved to the one module every SIASAR-reading piece
  of backend code already imports from
  (`app/routers/siasar.py`, and `buscar_comunidad_cercana` itself).
- **`fecha_encuesta_min`/`fecha_encuesta_max` in `resumen-municipios`**
  combine both `siasar_comunidad` and `siasar_sistema` survey dates for
  that municipio (not just one table) — the spec doesn't say which, and
  "the survey date range for this municipio's SIASAR data" reads most
  naturally as covering everything SIASAR surveyed there, not just one of
  the two record types.
- **`resumen-municipios`'s driving row set** is `SELECT municipio FROM
  siasar_comunidad UNION SELECT municipio FROM siasar_sistema` (same
  pattern as `/siasar/municipios`) — a municipio with systems but zero
  communities (or vice versa) still gets a row, with the missing side's
  counts at 0, rather than being silently dropped by an inner join.
- **Verified against the real imported dataset** (not just fixtures):
  `/siasar/municipios` returns exactly 112 rows; Zipaquirá shows 36
  communities / 7 systems; `/siasar/cercana` around the town center finds
  a community ~1.8km away; `/siasar/resumen-municipios` as MODERADOR
  returns real per-municipio diagnostic counts. `/siasar/resumen-municipios`
  as CIUDADANO correctly 403s.

## Decisions and deviations (Phase 3)

- **Marker `shape: 'pin' | 'circle'`** — the spec assumes the *current*
  report marker is a literal map pin and 'circle' is new. It isn't: every
  report marker already renders as a filled `google.maps.SymbolPath.CIRCLE`
  (scale 10) — there's no pin shape anywhere in this codebase today (only
  the Andi Moderador/Infra work added a `'square'` option, this session,
  for infrastructure markers). Implemented the spirit instead: SIASAR
  markers reuse the existing default circle rendering but pass a new
  optional `scale` (`MapMarker.scale`, default 10) at `7`, so they read as
  visually smaller/secondary next to a report's circle on the same map —
  matches the intent ("distinct from a report pin") without inventing a
  shape the app has never actually had.
- **System map-marker color** isn't specified by the task (only the
  community rating A–D legend is). Colored by `prueba_coliformes`
  (PASA/NO_PASA/SIN_PRUEBA, same `PRUEBA_COLOR` map the detail card uses)
  since a water-quality test result is the most decision-relevant signal
  for a citizen glancing at the map.
- **Layer toggles live only on `ciudadano/MapaScreen.tsx`** — it's the only
  full-screen interactive map with layer-control real estate in the app
  (confirmed in Phase 0 discovery). Moderador and Entidad have no "Mapa"
  tab in their navigators today (Moderador: Triage/Historial/Infra/Perfil;
  Entidad: Asignados/Cifras/Crear/Historial/Perfil) — adding one wasn't
  part of this task's scope (constraint 1, additive only, plus no request
  to add navigation surface).
- **`"potable"` grep**: one pre-existing occurrence remains in
  `frontend/src/screens/auth/LoginScreen.tsx` ("Saneamiento y Agua Potable
  · Zipaquirá", a generic tagline predating this feature, unrelated to
  SIASAR data). Not touched — the constraint is "no *new* occurrences" and
  this isn't near any SIASAR view. `src/theme/siasar.ts` also contains the
  word once, inside a comment *documenting* the rule itself, not as
  user-facing text.
- **Verified**: `npx tsc --noEmit` and `npx expo lint` both clean (0 lint
  errors; only the same pre-existing warning patterns already present
  elsewhere in the repo); `npx expo export --platform web` bundles
  successfully with the new theme/API/map-layer code included.

## Decisions and deviations (Phase 4)

- **`vereda_siasar` nesting**: `_select_reporte_detalle_sql()` returns the
  linked community's columns flat (`vereda_id_siasar`, `vereda_nombre`,
  ...) via a `LEFT JOIN siasar_comunidad`, and a new
  `_anidar_vereda_siasar(row)` helper folds them into the nested
  `vereda_siasar` object (or `None`) `ReporteDetalle` expects, applied at
  all five call sites that use that SELECT (list, detail, create, change-
  state, assign-entity). Chosen over a Pydantic `model_validator` because
  it keeps the transformation next to the SQL it depends on, in the same
  style already used everywhere else in this router (plain dict
  manipulation, no ORM/validator magic).
- **Client-sent `id_siasar_comunidad`/`distancia_siasar_m` are ignored**
  simply because `ReporteCreateRequest` never declares those fields —
  Pydantic drops unknown keys by default, so there's nothing to explicitly
  guard against. Verified by
  `test_cliente_no_puede_enviar_id_siasar_comunidad`.
- **Shared `SiasarComunidadInfo` component** (`frontend/src/components/`):
  the community-detail rendering (population, coverage, schools, rating
  badge, linked systems, source line) is written once and used by both
  `MapaScreen`'s marker-press panel (Phase 3) and the entity/moderator
  "Diagnóstico oficial de la zona" card (Phase 4) — same fields, same
  labels, so they can never drift apart.
- **Which roles see the diagnostic card**: `DetalleReporteScreen.tsx`
  is shared by every role (Ciudadano/Admin via the "classic" view,
  Entidad via the Andi "Cerrar el reporte" view — Moderador doesn't
  navigate here today, see Phase 3's decisions). The card is gated on
  `canChangeStatus` in the classic view (true for Moderador/Admin, false
  for Ciudadano) so a citizen never sees "official diagnostic of your own
  neighborhood" bolted onto their own report; it's unconditional in the
  Entidad view since that whole view is staff-only.
- **Fetches the full detail, not just the summary**: `vereda_siasar` only
  carries `id_siasar/nombre/localidad/municipio/calificacion/distancia_m/
  fecha_encuesta` (per the spec's own field list) — the diagnostic card
  needs population/coverage/schools/linked-systems too, so it does one
  extra `GET /siasar/comunidades/{id}` (endpoint 4, as the spec says)
  rather than trying to stretch the summary shape to cover both uses.

## Decisions and deviations (Phase 5)

- **Section placed only in `admin/DashboardScreen.tsx`**, not surfaced to
  Moderador anywhere in the UI — the task says "In the admin dashboard, add
  the section", and Moderador has no Dashboard screen/tab in this app at
  all (Triage/Historial/Infra/Perfil). The backend endpoint still allows
  MODERADOR (per its own spec table), so nothing stops a future Moderador
  screen from reusing `siasarAPI.resumenMunicipios()` — this phase just
  doesn't add one, matching "no new navigation surface" from Phase 3.
- **Table scrolls horizontally** (`ScrollView horizontal`) rather than
  wrapping/shrinking columns — six columns (municipio + 5 numeric) at
  legible width don't fit a phone screen, and municipality names in this
  dataset run up to 27 characters (`ZIPAQUIRÁ` is short; others aren't).
- **Date range caption** formats `fecha_encuesta_min`/`max` as DD/MM/AAAA,
  matching the `fuenteConFecha()` convention already established in
  `theme/siasar.ts` (Phase 3) rather than inventing a second date format.
- **Verified**: `tsc --noEmit` and `expo lint` clean; live smoke test
  against the real imported dataset — `/siasar/resumen-municipios` as
  ADMIN returns all 112 municipios with the exact shape the dashboard
  reads (`comunidades`, `comunidades_d`, `sistemas_sin_cloracion`, ...,
  `reportes_total`/`reportes_abiertos`, `fecha_encuesta_min/max`).

## Decisions and deviations (finalization)

- **Backend README** (`backend/README.md`): added `siasar.py` to the
  router listing, the 7 SIASAR endpoints to the endpoints table, the 3
  new tables to "Tablas principales", and a "SIASAR" section with the
  exact migration/import commands.
- **Frontend README** (`frontend/README.md`): corrected the Leaflet/
  OpenStreetMap claims (three spots — component listing, stack table,
  Google Maps setup step) to Google Maps, matching what
  `src/components/mapHtml.ts` actually does (confirmed in Phase 0). Added
  `SiasarComunidadInfo.tsx` and `theme/siasar.ts` to the structure
  listing, `siasarAPI` to the services mention, and a one-line note to
  the Ciudadano/Entidad/Admin screen tables describing what each gained.
  **Not fixed** (pre-existing, unrelated to SIASAR, out of this task's
  scope): the frontend README still describes the codebase as `.js`
  (`App.js`, `client.js`, `AppNavigator.js`, ...) when it's actually
  TypeScript (`.tsx`/`.ts`) throughout, and the Moderador/Entidad screen
  tables don't reflect the `TriageScreen`/`InfraestructuraScreen`/
  `CifrasEntidadScreen`/Andi-visual-system work done earlier in this same
  session, before the SIASAR task started — both predate SIASAR and
  aren't part of "the new router, endpoints, screens and components"
  this task's instructions ask to document.

## Open questions

- None so far — every `infraestructura_hidrica` row with
  `fuente = 'SIASAR'` in the dump/dev DB was one of the two known
  placeholders; no unexpected SIASAR-sourced row was found.
