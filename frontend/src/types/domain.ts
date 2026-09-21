/**
 * Readable aliases for `components["schemas"][...]` in the generated
 * api.d.ts. Never redeclare a shape by hand here — a hand-written
 * duplicate drifts from the backend, which is the exact bug class this
 * migration exists to prevent. Regenerate api.d.ts (`npm run gen:api`)
 * when the backend contract changes; these aliases follow automatically.
 */
import type { components } from './api';

// ── Reportes ────────────────────────────────────────────────────────
export type Reporte = components['schemas']['ReporteDetalle'];
// Vista comunitaria de GET /reportes/{id}: la recibe un CIUDADANO que
// consulta el reporte de otro (ver backend/app/schemas/reportes.py). No
// trae id_usuario ni usuario -- cualquier pantalla que acepte `Reporte |
// ReporteComunidad` debe tratar esos dos campos como ausentes.
export type ReporteComunidad = components['schemas']['ReporteComunidadDetalle'];
export type ReporteMapaPunto = components['schemas']['ReporteMapaPunto'];
export type ReporteCreateRequest = components['schemas']['ReporteCreateRequest'];
export type CrearReporteResponse = components['schemas']['CrearReporteResponse'];
export type CambiarEstadoRequest = components['schemas']['CambiarEstadoRequest'];
export type CambiarEstadoResponse = components['schemas']['CambiarEstadoResponse'];
export type AsignarEntidadRequest = components['schemas']['AsignarEntidadRequest'];
export type HistorialEntry = components['schemas']['HistorialEntry'];
// Vista comunitaria de GET /reportes/{id}/historial -- sin id_usuario_accion
// ni usuario_accion, mismo criterio que ReporteComunidad arriba.
export type HistorialEntryComunidad = components['schemas']['HistorialEntryComunidad'];
export type EstadisticasResponse = components['schemas']['EstadisticasResponse'];
export type EstadisticaEstadoItem = components['schemas']['EstadisticaEstadoItem'];
export type EstadisticaTipoItem = components['schemas']['EstadisticaTipoItem'];
export type EstadisticaSeveridadItem = components['schemas']['EstadisticaSeveridadItem'];
export type EstadisticaMesItem = components['schemas']['EstadisticaMesItem'];

// ── Catálogos (datos de tabla en runtime, no enums — ver models.ts) ──
export type EstadoReporteItem = components['schemas']['EstadoReporteItem'];
export type TipoIncidenteItem = components['schemas']['TipoIncidenteItem'];
export type SeveridadItem = components['schemas']['SeveridadItem'];
export type CategoriaIncidenteItem = components['schemas']['CategoriaIncidenteItem'];

// ── Usuarios ──────────────────────────────────────────────────────────
export type UserPublic = components['schemas']['UserPublic'];
export type UsuarioListItem = components['schemas']['UsuarioListItem'];
export type UsuarioDetalleResponse = components['schemas']['UsuarioDetalleResponse'];
export type UsuarioPendienteItem = components['schemas']['UsuarioPendienteItem'];
export type PendientesResponse = components['schemas']['PendientesResponse'];
export type PerfilResponse = components['schemas']['PerfilResponse'];
export type RegistroUsuario = components['schemas']['RegistroUsuario'];
export type ActualizarPerfil = components['schemas']['ActualizarPerfil'];
export type CambiarPassword = components['schemas']['CambiarPassword'];
export type CambiarEstadoCuenta = components['schemas']['CambiarEstadoCuenta'];
export type RegistroResponse = components['schemas']['RegistroResponse'];
export type ActualizarPerfilResponse = components['schemas']['ActualizarPerfilResponse'];
export type CambiarPasswordResponse = components['schemas']['CambiarPasswordResponse'];
export type CambiarEstadoUsuarioResponse = components['schemas']['CambiarEstadoUsuarioResponse'];

// ── Entidades ─────────────────────────────────────────────────────────
export type EntidadDetalle = components['schemas']['EntidadDetalle'];
export type EntidadCreate = components['schemas']['EntidadCreate'];
export type EntidadUpdate = components['schemas']['EntidadUpdate'];
export type UsuarioDeEntidadItem = components['schemas']['UsuarioDeEntidadItem'];
export type UsuariosDeEntidadResponse = components['schemas']['UsuariosDeEntidadResponse'];
export type CambiarEstadoEntidad = components['schemas']['CambiarEstadoEntidad'];
export type CambiarEstadoEntidadResponse = components['schemas']['CambiarEstadoEntidadResponse'];
export type AsignarUsuarioResponse = components['schemas']['AsignarUsuarioResponse'];
export type CrearEntidadResponse = components['schemas']['CrearEntidadResponse'];
export type ActualizarEntidadResponse = components['schemas']['ActualizarEntidadResponse'];

// ── Infraestructura ───────────────────────────────────────────────────
export type InfraestructuraItem = components['schemas']['InfraestructuraItem'];
export type InfraestructuraCreate = components['schemas']['InfraestructuraCreate'];
export type InfraestructuraUpdate = components['schemas']['InfraestructuraUpdate'];
export type CrearInfraestructuraResponse = components['schemas']['CrearInfraestructuraResponse'];
export type ActualizarInfraestructuraResponse =
  components['schemas']['ActualizarInfraestructuraResponse'];

// ── Notificaciones ───────────────────────────────────────────────────
export type NotificacionItem = components['schemas']['NotificacionItem'];
export type MarcarLeidaResponse = components['schemas']['MarcarLeidaResponse'];
export type MarcarTodasLeidasResponse = components['schemas']['MarcarTodasLeidasResponse'];

// ── Auditoría ─────────────────────────────────────────────────────────
export type LogAuditoriaItem = components['schemas']['LogAuditoriaItem'];
export type ListarLogsResponse = components['schemas']['ListarLogsResponse'];
export type ResumenModuloItem = components['schemas']['ResumenModuloItem'];

// ── Auth ──────────────────────────────────────────────────────────────
export type LoginResponse = components['schemas']['LoginResponse'];

// ── SIASAR (capa oficial de solo lectura) ──────────────────────────────
export type Calificacion = components['schemas']['Calificacion'];
export type Cloracion = components['schemas']['Cloracion'];
export type PruebaLaboratorio = components['schemas']['PruebaLaboratorio'];
export type MunicipioSiasar = components['schemas']['MunicipioSiasar'];
export type ComunidadMapa = components['schemas']['ComunidadMapa'];
export type SistemaMapa = components['schemas']['SistemaMapa'];
export type ComunidadDetalle = components['schemas']['ComunidadDetalle'];
export type SistemaDetalle = components['schemas']['SistemaDetalle'];
export type SistemaResumen = components['schemas']['SistemaResumen'];
export type ComunidadResumen = components['schemas']['ComunidadResumen'];
export type CercanaResponse = components['schemas']['CercanaResponse'];
export type ResumenMunicipio = components['schemas']['ResumenMunicipio'];
export type VeredaSiasarResumen = components['schemas']['VeredaSiasarResumen'];
