# TypeScript migration — findings

Originally written at the end of the `frontend/src/` → TypeScript migration
(branch `feat/typescript`), when every bug below was **preserved behind a
narrow `as unknown as X` cast**, per that migration's "behavior must not
change" mandate. **All of them have since been fixed** in a follow-up pass
on the same branch — each cast removed, each field renamed to the real one,
each dead call corrected or removed. `grep -rn "as unknown as" src/` now
returns nothing.

The single most common pattern by far was **a frontend field name that
doesn't exist on the backend's actual response**, almost always because the
frontend was written against an older/assumed API shape (split
`nombre`/`apellido`, `direccion_aproximada`, boolean `activo`, numeric
`id_rol`/`id_tipo`) that the current backend never returns, or has since
renamed.

## Fix status

| # | Item | Status | Commit |
|---|---|---|---|
| 1 | CrearReporteScreen — tipo de incidente selector | ✅ Fixed | `2e86b23` |
| 2 | `direccion_aproximada` → `direccion` (write + read) | ✅ Fixed | `4ef1bb3` |
| 3 | UsuariosScreen — `activo`/`id_rol` → real fields | ✅ Fixed | `ed435c3` |
| 4 | EntidadesScreen — entity names never displayed | ✅ Fixed | `aac6382` |
| 5 | AuditoriaScreen — `{total, logs}` wrapper | ✅ Fixed | `c644ca8` |
| 6 | Dead calls (`toggleEstado`, `cambiarEstado` body) | ✅ Corrected | `52f8634` |
| 7 | `ciudadano/PerfilScreen.tsx` — orphaned file | ✅ Deleted | `1e1486c` |
| — | HistorialScreen — `usuario_nombre`/`apellido` | ✅ Fixed | `4786703` |
| — | NotificacionesScreen — phantom `titulo` | ✅ Fixed | `93d4653` |
| — | MapaScreen — 3 remaining casts (wrapper, `descripcion`, navigate) | ✅ Fixed | `4de6f05` |

The last three rows weren't in the task's 7 numbered items but were the same
class of bug documented below, bundled with fields already being touched,
and needed to reach the zero-cast completion criterion.

## What each fix actually did

**CrearReporteScreen — incident-type selector (`2e86b23`, `4ef1bb3`).**
`TipoIncidenteItem`'s real field is `id_tipo_incidente`, not `id_tipo`.
Every chip's id had been `undefined`, so tapping one highlighted every chip
at once and set `idTipo` to `undefined` — the submit guard could never pass.
Now reads `t.id_tipo_incidente` directly. Separately, the create-report
payload sent `direccion_aproximada` (ignored by the backend — the real
field is `direccion`) and never sent the schema-required `fuente_reporte`.
Both fixed: the payload now sends `direccion` and an explicit
`fuente_reporte: 'CIUDADANO'` (the exact value the backend already defaulted
to when the field was absent, so this is a typing fix, not a behavior
change).

**Read-side `direccion_aproximada`/`fecha_creacion`/split names (`4ef1bb3`).**
`ReportCard.tsx` and `DetalleReporteScreen.tsx` both read
`reporte.direccion_aproximada` (real: `direccion`) and `reporte.fecha_creacion`
(real: `created_at`). `DetalleReporteScreen` additionally read
`usuario_nombre`/`usuario_apellido` — fixed to read the real, already-combined
`reporte.usuario` field instead. Two fields in that same cast,
`fecha_actualizacion` and `entidad_nombre`, have **no equivalent field on
`ReporteDetalle` at all** (no `updated_at` column, no entidad-name join) —
fixing them for real would need a backend change, out of scope. Both
`DetailRow`s were permanently dead code (their guards could never be true),
so removed rather than left behind an unremovable cast.

**UsuariosScreen (`ed435c3`).** `UsuarioListItem` has no
`activo`/`id_rol`/`nombre`/`apellido`. Confirmed the real catalog values
against `backend/geovisor_backup_limpio.sql`: `estado_cuenta` is
`'ACTIVO'|'INACTIVO'|'SUSPENDIDO'|'PENDIENTE'`, `rol` is
`'CIUDADANO'|'ENTIDAD'|'MODERADOR'|'ADMINISTRADOR'` (role *names*, not
numeric ids). `activo` is now derived as `estado_cuenta === 'ACTIVO'`;
`ROL_COLOR`/`ROL_LABEL` are now keyed by that string. Role badges show the
real role with the real color, the active/inactive badge reflects the real
account state, and the search box (now matching `nombre_completo` +
`correo`) can actually find someone by name.

**EntidadesScreen (`aac6382`).** Same shape of bug: `EntidadDetalle` has no
`activo`/`nombre`/`email`. Real fields: `nombre_entidad`, `estado_cuenta`,
`correo_institucional`. The entity's real name now renders (it never did
before). `descripcion` had no equivalent field on `EntidadDetalle` at all —
removed that always-dead display block.

**AuditoriaScreen (`c644ca8`).** `auditoriaAPI.listar()` returns
`{ total, logs: LogAuditoriaItem[] }`, not a bare array. `setLogs(res.data ||
[])` never fell through to the empty array (`res.data` is always a truthy
object), so `logs` held the wrapper object itself — FlatList's `data` had no
usable `.length`, so the screen almost certainly always rendered its empty
state regardless of real audit data. Fixed to `setLogs(res.data?.logs ||
[])`.

**Dead/broken calls (`52f8634`).** Corrected rather than removed, since a
real working endpoint already existed for what each button was trying to
do:
- `usuariosAPI.toggleEstado` → `PUT /usuarios/{id}/toggle-estado` doesn't
  exist (404 every time). Deleted the dead service function; the toggle
  button now calls the real `usuariosAPI.cambiarEstado(id, {
  id_estado_cuenta })`, passing the opposite of the account's current state.
- `entidadesAPI.cambiarEstado` sent `{ activo: boolean }`; the real schema
  (`CambiarEstadoEntidad`) is `{ id_estado_cuenta: number }` — every real
  call 422'd. Changed the function's signature to take that shape directly;
  the entity toggle button now sends the correct body.

**Orphaned file (`1e1486c`).** `src/screens/ciudadano/PerfilScreen.tsx` —
confirmed via repo-wide grep (zero matches) and by reading
`AppNavigator.tsx` directly (it wires `screens/shared/PerfilScreen` for
every role including ciudadano) that this file was never reachable from any
navigator. Deleted.

**HistorialScreen (`4786703`).** `item.usuario_nombre`/`usuario_apellido` on
`HistorialEntry` don't exist; the real, always-present field is
`usuario_accion`. The "who made this change" line now always renders it.

**NotificacionesScreen (`93d4653`).** `item.titulo` doesn't exist on
`NotificacionItem`, and unlike the others there's no direct real-field
equivalent — `tipo_notificacion` is an internal code, not display-ready
text, and mapping it to friendly titles would be inventing new UI logic,
not correcting a field name. Kept the exact same rendered text
("Actualización de reporte") as a literal instead of a cast-guarded
fallback that could never resolve any other way.

**MapaScreen (`4de6f05`) — the last three casts.**
1. `reportesAPI.mapa()`'s response was defensively unwrapped for an old
   `{ puntos: [...] }` shape the backend never actually returns (a bare
   `ReporteMapaPunto[]`). Simplified to `res.data || []`.
2. The marker builder read `p.descripcion` off `ReporteMapaPunto`, which has
   no such field and no equivalent — removed the property.
3. **The one fix in this whole pass that changes real user-visible
   behavior for the better, not just for compilation correctness**:
   navigating to `DetalleReporte` from the map's pin panel passed the
   `MapMarker` itself (only `id`/`lat`/`lng`/`severidad`/`estado`) cast as a
   full `Reporte`. `DetalleReporteScreen`'s `hasCoords` check was always
   `false` on this path (the marker has `lat`/`lng`, not
   `latitud`/`longitud`), so its map section never rendered. Now fetches the
   real report first via `reportesAPI.obtener(id)` — an endpoint the
   backend already exposes — and navigates with that. The detail screen's
   map now renders correctly no matter which screen a report was opened
   from.

## Remaining `any` / `unknown` (unchanged by this fix pass)

**`any`** — exactly one in the whole codebase:
- `src/api/client.ts:8` — `interface AxiosError<T = unknown, D = any, P =
  any>` (module augmentation adding `friendlyMessage`). `D`/`P` are `any`
  because that's how axios's own `AxiosError` declares them; matching the
  library's own generic defaults is what makes the declaration-merge valid.

**`unknown`** — narrow and justified, none left over from a fixed bug:
- `src/api/client.ts:83` — the response interceptor's error param, narrowed
  immediately via `axios.isAxiosError()`.
- `src/api/services.ts:78,136` — `usuariosAPI.listar`/`entidadesAPI.listar`
  accept `Record<string, unknown>` passthrough params, even though the
  backend's real query type is `never` (no params at all). Both are only
  ever called with zero arguments — inert, kept loose rather than asserting
  a stricter contract than the code actually uses.

No `X as unknown as Y` casts remain anywhere in `src/`.

## Behavior inconsistencies noted, left as-is (backend change required or genuinely no-op)

- **`DetalleReporteScreen.tsx`** — `route.params.reporte` is typed
  `required` in `RootStackParamList`. The existing `route.params || {}`
  defensive destructure and the `if (!reporte) return <View>...</View>`
  guard are provably dead code under that honest typing (an object is never
  falsy) — left in place, since removing "unreachable but harmless" code
  wasn't part of either the typing migration or this fix pass's mandate.
- **`DetalleReporteScreen.tsx`** — `handleUpdateEstado` asserts
  `idEstadoNuevo as number`. Not a mismatch: the preceding
  `estadosDisponibles.find(...)` already proves it can't be null at that
  point; TypeScript just can't see through the `.find()` callback boundary.
- **`fecha_actualizacion`/`entidad_nombre`** (`DetalleReporteScreen`) and
  **`descripcion`** (`EntidadesScreen`) — no equivalent field exists on the
  backend's real schema at all. Fixing these for real requires a backend
  change (a new column/join), out of scope for a frontend-only task. The
  dead UI that depended on them was removed instead of left behind an
  unremovable cast.
- **`titulo`** (`NotificacionesScreen`) — same situation: no backend
  equivalent, kept the existing fallback text as a literal.
- **RegisterScreen sends `id_rol: 1`** — `RegistroUsuario`'s real schema has
  no `id_rol` field. Almost certainly inert rather than broken: a public
  signup endpoint accepting a client-supplied role would be a
  privilege-escalation bug, so the backend dropping this field is *correct*
  behavior. Not touched.
- **`String(...)` wrapping** around `parseFloat(...)` calls and the avatar-
  initials char-indexing (from the original migration, unaffected by this
  fix pass) — typing-only changes, not behavior changes; see git history on
  those commits for detail.

## Files converted (unchanged from the original migration)

All of `frontend/src/` — 33 files (32 hand-written + the generated
`types/api.d.ts`), zero `.js`/`.jsx`. See `git log` on `feat/typescript` for
the full per-file commit history, both the original migration and this
fix pass.

## Final verification

```
$ grep -rn "as unknown as" src/
(no output)

$ npx tsc --noEmit
(no output)
$ echo $?
0
```

Zero errors under `strict: true` (`noImplicitAny`, `strictNullChecks`, etc.
all on) plus `noUncheckedIndexedAccess`.

`npx expo export --platform android` (832 modules) and
`npx expo export --platform web` (557 modules) both succeed.
`git diff --stat ../backend` is empty — no backend file was touched by
either the migration or this fix pass.
