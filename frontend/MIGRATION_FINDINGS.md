# TypeScript migration — findings

Written at the end of the `frontend/src/` → TypeScript migration (branch
`feat/typescript`). Every item below was **preserved, not fixed** — the
migration's mandate was "behavior must not change." Typing a file honestly,
in several cases, meant the compiler caught a real, pre-existing bug; those
are typed via a narrow local cast confined to exactly the broken field(s),
so the rest of each file stays checked against the real backend contract.

The single most common pattern by far: **a frontend field name that doesn't
exist on the backend's actual response**, almost always because the
frontend was written against an older/assumed API shape (split
`nombre`/`apellido`, `direccion_aproximada`, boolean `activo`, numeric
`id_rol`/`id_tipo`) that the current backend never returns, or has since
renamed. In every case TypeScript flagged it the moment the surrounding
file was typed against the real generated schema — this is exactly the bug
class this migration exists to surface.

## Contract mismatches, by severity

### Severe — visibly broken screens

**`src/screens/admin/UsuariosScreen.tsx`** (cast at line 19, `UsuarioLegacy`).
`UsuarioListItem` (`usuariosAPI.listar()`'s real return type) has no
`activo`, `id_rol`, `nombre`, or `apellido`. Real fields: `nombre_completo`
(already combined — that particular fallback still works), `estado_cuenta:
string`, `rol: string`.
- `!item.activo` is always `true` → every user row renders dimmed with an
  "Inactivo" badge, regardless of real status.
- `ROL_LABEL[item.id_rol]` is always `undefined` (blank role badge);
  `ROL_COLOR[item.id_rol] + '25'` literally evaluates to the string
  `"undefined25"` as a `backgroundColor`.
- The search box matches against `` `${nombre} ${apellido} ${correo}` `` —
  since the first two are always `undefined`, name search never narrows
  anything; only email substrings actually filter.
- The toggle button calls `usuariosAPI.toggleEstado()` — see "Dead endpoint
  calls" below.

**`src/screens/admin/EntidadesScreen.tsx`** (cast at line 15, `EntidadLegacy`).
`EntidadDetalle` has no `activo`, `nombre`, `descripcion`, or `email`. Real
fields: `nombre_entidad`, `estado_cuenta: string`, `correo_institucional`;
there is no description concept in the schema at all.
- `item.nombre` always `undefined` → **the entity's name never renders** —
  every card shows only an icon, phone (if present), and an
  always-"Inactiva" badge. Nothing visually distinguishes one entity from
  another.
- Same always-"Inactiva" bug as UsuariosScreen; the header's "N activas"
  count (line 67) is always 0.
- `item.email` always `undefined` → email line never shows.
- Confirms the `entidadesAPI.cambiarEstado` body-shape bug below: this
  screen (line 39) is its one real caller.

**`src/screens/admin/AuditoriaScreen.tsx`** (line 42) — different failure
shape, a response *wrapper* mismatch rather than a field-name one.
`auditoriaAPI.listar()` returns `ListarLogsResponse = { total: number; logs:
LogAuditoriaItem[] }`, not a bare array. The screen did
`setLogs(res.data || [])`; since `res.data` is always a truthy object, `||
[]` never triggers, and `logs` state ends up holding the *wrapper object*
itself. That object is then handed straight to `<FlatList data={logs}>`,
which has no usable `.length` on a non-array — **the Auditoría screen
almost certainly always renders its empty state**, regardless of how much
real audit data exists. Every individual field on a log item (`accion`,
`modulo`, `fecha_accion`, `usuario`, `id_log`) is otherwise correct; the
bug is entirely in that one unwrapping line. The real fix would be
`res.data?.logs || []`.

**`src/screens/ciudadano/CrearReporteScreen.tsx`** — two independent bugs:
1. **Tipo de incidente selector is non-functional** (cast at line 181,
   `tLegacy`). `TipoIncidenteItem`'s real field is `id_tipo_incidente`, not
   `id_tipo`. Every chip's id is `undefined`, so: no real React `key`;
   tapping any chip makes `idTipo === t.id_tipo` true for *every* chip
   simultaneously (`undefined === undefined`), so all light up together;
   and `setIdTipo(undefined)` means the submit guard `if (!idTipo)` can
   never pass via this control. Severidad's equivalent selector is correct
   (`SeveridadItem.id_severidad` matches).
2. **The address the user types is silently dropped** (line 107). The
   create-report payload sends `direccion_aproximada`, but
   `ReporteCreateRequest`'s real field is `direccion`; FastAPI/Pydantic
   ignores unknown body fields, so `direccion` is `null` in the DB for
   every report created here — the write-side twin of the read-side bug
   below. Separately, `ReporteCreateRequest.fuente_reporte` is marked
   required in the generated schema but never sent — almost certainly
   harmless (a server-side default applies), likely an
   openapi-typescript/FastAPI quirk rather than a real bug.

**`src/screens/ciudadano/MapaScreen.tsx`** (line 154) —
`navigation.navigate('DetalleReporte', { reporte: selectedPin })` passes a
`MapMarker` (id/lat/lng/severidad/estado/descripcion), not a full `Reporte`.
Opening a report from the citizen map's pin panel gives DetalleReporteScreen
an object missing `direccion`, `imagen_url`, `fuente_reporte`, `created_at`,
`id_usuario`, `id_entidad`, `id_tipo_incidente`, `id_severidad`,
`tipo_incidente`, `usuario` — and even `latitud`/`longitud` (the marker only
has `lat`/`lng`). Concrete effect: `hasCoords` is `false` for every report
opened this way, so **the map section never renders** on this navigation
path — only reachable via MisReportesScreen (which passes a real `Reporte`)
does the detail screen's own map show up.

Also in this file (lines 51–52): `res.data?.puntos || res.data || []` —
dead defensive code for an older wrapped `{ puntos: [...] }` response shape
the backend no longer returns (the real shape is a bare
`ReporteMapaPunto[]`), harmless since it falls straight through. And (line
84) `p.descripcion` — `ReporteMapaPunto` has no description field at all
(only `direccion`, `tipo_incidente`, `fecha_reporte` besides the obvious
ones) — always `undefined`.

### Real bugs, smaller blast radius

**`src/components/ReportCard.tsx`** (cast at line 24) and
**`src/screens/entidad/DetalleReporteScreen.tsx`** (cast at line 102) — both
read `reporte.direccion_aproximada` (real: `direccion`) and
`reporte.fecha_creacion` (real: `created_at`) on `Reporte`
(`ReporteDetalle`). DetalleReporteScreen additionally reads
`usuario_nombre`/`usuario_apellido` (real: one combined `usuario: string`
field) and `fecha_actualizacion`/`entidad_nombre` (neither exists on
`ReporteDetalle` at all). Effect: "Dirección" and "Reportado por" always
show their fallback text, "Última actualización" and "Entidad asignada"
never render (both guarded by truthy-checks on undefined fields).

**`src/screens/moderador/HistorialScreen.tsx`** (line 76) — reads
`item.usuario_nombre`/`item.usuario_apellido` on `HistorialEntry`; the real
field is `usuario_accion` (one combined name, plus `rol_usuario_accion`).
The "👤 who made this change" line never renders. **This is the third
sighting of the exact same shape of bug** (split name fields expected,
backend returns one combined field) — strong evidence the whole frontend
was originally written against a backend version that split first/last
name, and every one of these call sites silently broke, with no errors,
when the backend consolidated to a single combined field.

**`src/screens/shared/PerfilScreen.tsx`** (line 16, `UserLegacy`) — a
different failure shape again. `user` (from `AuthContext`) is always
`UserPublic`, which has no `telefono` field by design (it's a deliberately
minimal identity shape — see `backend/CLAUDE.md` — not the fuller
`PerfilResponse` that `usuariosAPI.perfil()` would return). Effect: the
"Teléfono" row always shows "No registrado" regardless of the real value.
Saving a phone number *does* work server-side (`ActualizarPerfil`, the real
`PUT /usuarios/perfil` request schema, accepts and persists `telefono`) —
but the local `updateUser({ ...user, telefono })` only patches the
in-memory `AuthContext.user`. The next `/auth/me` revalidation (every app
cold start) returns `UserPublic` again, so a successfully-saved phone
number visibly reappears as blank on next launch even though it's sitting
correctly in the database.

**`src/screens/ciudadano/PerfilScreen.tsx`** — see "Dead files" below; has
the identical bug (plus split-name and `fecha_creacion`/`activo` reads),
but is unreachable, so none of it is currently observable.

**`src/screens/auth/RegisterScreen.tsx`** (line 59) — sends `id_rol: 1` in
the registration payload; `RegistroUsuario` (the real `POST
/usuarios/registro` request schema) has no `id_rol` field. Almost certainly
inert rather than broken: a public signup endpoint accepting a
client-supplied role would be a privilege-escalation bug, so the backend
dropping this field is *correct* behavior — just stale/undocumented on the
frontend.

## Dead endpoint calls

- **`usuariosAPI.toggleEstado`** (`src/api/services.ts:83`) →
  `PUT /usuarios/{id}/toggle-estado`. Confirmed via grep on `api.d.ts`: no
  such path exists (only `/usuarios/{id_usuario}` and
  `/usuarios/{id_usuario}/estado`, the latter already correctly used by
  `cambiarEstado`). Reachable, not orphaned: `UsuariosScreen.tsx`'s toggle
  button calls it — it 404s every time it's clicked.
- **`entidadesAPI.cambiarEstado`** (`src/api/services.ts:148`) sends
  `{ activo: boolean }` as the request body; the real schema,
  `CambiarEstadoEntidad`, is `{ id_estado_cuenta: number }` — no `activo`
  field, and the one required field is never sent, so every real call gets
  a 422. `EntidadesScreen.tsx` is its one caller, and it computes that
  boolean from `entidad.activo` — itself always `undefined` (see above) —
  so this button has, in all likelihood, never worked.

## Dead file

**`src/screens/ciudadano/PerfilScreen.tsx`** — discovered during Step 7
cleanup (it was still `.js`, missed in the initial per-folder pass). Not
imported anywhere (`grep -rn "ciudadano/PerfilScreen" src` → zero matches);
`AppNavigator.tsx` wires `screens/shared/PerfilScreen` for every role's
`Perfil` tab, ciudadano included. An older, smaller (134 lines vs. 300+)
duplicate, almost certainly left over from before the profile screen was
consolidated into one shared component. Converted to `.tsx` (same
`UserLegacy` pattern) only because Step 7 requires zero `.js` under `src/`
— **not deleted**, since removing a file is a bigger action than this
migration's mandate covers. Recommend the project owner delete it in a
follow-up, non-migration commit.

## Every remaining `any` / `unknown`

**`any`** — exactly one in the whole codebase:
- `src/api/client.ts:8` — `interface AxiosError<T = unknown, D = any, P =
  any>` (module augmentation adding `friendlyMessage`). `D` and `P` are
  typed `any` because that's how axios's own `AxiosError` declares them;
  matching the library's own generic defaults is what makes the
  declaration-merge valid. Not a case where `unknown` would work — it
  would create a mismatch against axios's own type, not remove one.

**`unknown`** — all narrow, all justified:
- `src/api/client.ts:83` — the response interceptor's error param, narrowed
  immediately via `axios.isAxiosError()`.
- `src/api/services.ts:83` — `toggleEstado`'s response type. The endpoint
  doesn't exist (see above), so there's no real response schema to type
  against; `unknown` avoids inventing one.
- `src/api/services.ts:77,139` — `usuariosAPI.listar`/`entidadesAPI.listar`
  accept `Record<string, unknown>` passthrough params, even though the
  backend's real query type is `never` (no params at all). Both are only
  ever called with zero arguments (grepped `UsuariosScreen`/
  `EntidadesScreen`), so this is inert — kept loose rather than asserting a
  stricter contract than the original JS actually had.
- Every `X as unknown as Y` cast listed throughout this document
  (`ReportCard.tsx:24`, `DetalleReporteScreen.tsx:102`, `MapaScreen.tsx:51,
  84, 154`, `CrearReporteScreen.tsx:111, 181`, `AuditoriaScreen.tsx:42`,
  `EntidadesScreen.tsx:39, 67, 86`, `UsuariosScreen.tsx:44, 71, 112`,
  `HistorialScreen.tsx:76`, `NotificacionesScreen.tsx:82`) — the standard
  pattern used throughout this migration for "the code reads a field the
  real type doesn't have." `unknown` as the intermediate step (rather than
  a direct cast) is required because the source and target types don't
  overlap enough for TypeScript to allow a single-step assertion; it is
  never a stand-in for "didn't bother typing this."

No implicit `any` exists anywhere: `strict: true` (which includes
`noImplicitAny`) passes with zero errors.

## Behavior inconsistencies noted, not fixed

- **`DetalleReporteScreen.tsx`** — `route.params.reporte` is typed
  `required` in `RootStackParamList` per the task's explicit Step 4
  instruction. That makes the existing `route.params || {}` defensive
  destructure, and the `if (!reporte) return <View>...</View>` guard below
  it, provably dead code under honest typing (an object is never falsy) —
  left in place untouched rather than deleted, since removing "unreachable
  but harmless" code is still a behavior/structure change outside this
  migration's scope.
- **`DetalleReporteScreen.tsx`** — `handleUpdateEstado` asserts
  `idEstadoNuevo as number`. Not a mismatch: the line above already does
  `estadosDisponibles.find(e => e.id_estado === idEstadoNuevo)` and returns
  early on no match, which proves `idEstadoNuevo` was a real number at that
  point — TypeScript's control-flow analysis just can't see through the
  `.find()` callback boundary to know that.
- **`client.ts`** response interceptor — wrapped the 401/`friendlyMessage`
  logic in `if (axios.isAxiosError(error))`. Not compiler-forced (axios
  types the rejected-handler param as plain `any`), done per the task's
  explicit instruction to narrow rather than rely on implicit `any`.
  Runtime-equivalent for every real code path, since this interceptor only
  ever receives what axios itself rejects with.
- Several `parseFloat(reporte.latitud)`-style calls (`DetalleReporteScreen`,
  `MapaScreen`) needed `String(...)` wrapping — `latitud`/`longitud` are
  real `number`s now (the backend's `DECIMAL_AS_FLOAT` conversion, from
  earlier work on this project), and `parseFloat` requires a `string`
  argument. `String(n)` round-trips to the identical numeric value
  `parseFloat` would already have produced from the implicit
  number→string coercion JS was doing, so this is purely a typing fix, not
  a behavior change.
- Same treatment for two `initial` (avatar letters) computations
  (`UsuariosScreen.tsx`, `ciudadano/PerfilScreen.tsx`): character-indexing
  a possibly-empty string can yield `undefined` under
  `noUncheckedIndexedAccess`; wrapped in `String(...)`, which reproduces
  the exact "undefined" substring the original `x + undefined` JS
  concatenation already produced for single-word names — a pre-existing
  edge case, not something this migration introduced or fixed.
- Five screens' `ListEmptyComponent={!loading && (<View>...)}` became
  `!loading ? (<View>...) : null` — strict JSX typing rejects a bare
  `false` there; React renders `false` and `null` identically, so this is
  a pure typing fix with no observable difference.

## Files converted

All of `frontend/src/` — 33 files (32 hand-written + the generated
`types/api.d.ts`), zero remaining `.js`/`.jsx`. Converted in this order,
one commit per group (see branch `feat/typescript` history for full
detail per commit):

1. `theme/colors.ts`
2. `api/client.ts`, `api/services.ts`
3. `context/AuthContext.tsx`
4. `navigation/AppNavigator.tsx`, `navigation/types.ts`
5. `components/*` (GradientHeader, LoadingScreen, StatusBadge, StatCard,
   ReportCard, mapHtml, MapaWebView, MapaWebView.web,
   MapaWebView.types — new shared types file) + `config/maps.ts`
6. `screens/auth/*`
7. `screens/ciudadano/*`
8. `screens/entidad/*`
9. `screens/moderador/*`
10. `screens/admin/*`
11. `screens/shared/PerfilScreen.tsx`
12. Step 7 cleanup: `screens/ciudadano/PerfilScreen.tsx` (orphaned file
    missed in step 7)
13. Step 8: `tsconfig.json` `strict: true`

Plus new type-only files: `types/domain.ts` (aliases derived from
`api.d.ts`), `types/models.ts` (`Rol`, `AuthContextValue`).

## Final `tsc --noEmit` output

```
$ npx tsc --noEmit
(no output)
$ echo $?
0
```

Zero errors under `strict: true` (`noImplicitAny`, `strictNullChecks`,
etc. all on) plus `noUncheckedIndexedAccess`.

`npx expo export --platform android` (832 modules) and
`npx expo export --platform web` (557 modules) both succeed.
`git diff --stat main -- backend/` is empty — no backend file was touched.
