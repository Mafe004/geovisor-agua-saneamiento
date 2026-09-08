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
export type ReporteMapaPunto = components['schemas']['ReporteMapaPunto'];
export type ReporteCreateRequest = components['schemas']['ReporteCreateRequest'];
export type HistorialEntry = components['schemas']['HistorialEntry'];
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

// ── Entidades ─────────────────────────────────────────────────────────
export type EntidadDetalle = components['schemas']['EntidadDetalle'];
export type EntidadCreate = components['schemas']['EntidadCreate'];
export type EntidadUpdate = components['schemas']['EntidadUpdate'];
export type UsuarioDeEntidadItem = components['schemas']['UsuarioDeEntidadItem'];
export type UsuariosDeEntidadResponse = components['schemas']['UsuariosDeEntidadResponse'];
export type CambiarEstadoEntidad = components['schemas']['CambiarEstadoEntidad'];

// ── Infraestructura ───────────────────────────────────────────────────
export type InfraestructuraItem = components['schemas']['InfraestructuraItem'];
export type InfraestructuraCreate = components['schemas']['InfraestructuraCreate'];
export type InfraestructuraUpdate = components['schemas']['InfraestructuraUpdate'];

// ── Notificaciones ───────────────────────────────────────────────────
export type NotificacionItem = components['schemas']['NotificacionItem'];

// ── Auditoría ─────────────────────────────────────────────────────────
export type LogAuditoriaItem = components['schemas']['LogAuditoriaItem'];
export type ListarLogsResponse = components['schemas']['ListarLogsResponse'];
export type ResumenModuloItem = components['schemas']['ResumenModuloItem'];

// ── Auth ──────────────────────────────────────────────────────────────
export type LoginResponse = components['schemas']['LoginResponse'];
