import client from './client';
import type { operations } from '../types/api';
import type {
  ActualizarEntidadResponse,
  ActualizarInfraestructuraResponse,
  ActualizarPerfil,
  ActualizarPerfilResponse,
  AsignarEntidadRequest,
  AsignarUsuarioResponse,
  CambiarEstadoCuenta,
  CambiarEstadoEntidad,
  CambiarEstadoEntidadResponse,
  CambiarEstadoRequest,
  CambiarEstadoResponse,
  CambiarEstadoUsuarioResponse,
  CambiarPassword,
  CambiarPasswordResponse,
  CategoriaIncidenteItem,
  CercanaResponse,
  ComunidadDetalle,
  ComunidadMapa,
  CrearEntidadResponse,
  CrearInfraestructuraResponse,
  CrearReporteResponse,
  EntidadCreate,
  EntidadDetalle,
  EntidadUpdate,
  EstadisticasResponse,
  EstadoReporteItem,
  HistorialEntry,
  HistorialEntryComunidad,
  InfraestructuraCreate,
  InfraestructuraItem,
  InfraestructuraUpdate,
  ListarLogsResponse,
  LoginResponse,
  MarcarLeidaResponse,
  MarcarTodasLeidasResponse,
  MunicipioSiasar,
  NotificacionItem,
  PerfilResponse,
  RegistroResponse,
  RegistroUsuario,
  Reporte,
  ReporteComunidad,
  ReporteCreateRequest,
  ReporteMapaPunto,
  ResumenModuloItem,
  ResumenMunicipio,
  SeveridadItem,
  SistemaDetalle,
  SistemaMapa,
  TipoIncidenteItem,
  UserPublic,
  UsuarioDetalleResponse,
  UsuarioListItem,
  UsuariosDeEntidadResponse,
} from '../types/domain';

type ReportesQuery = operations['listar_reportes_reportes__get']['parameters']['query'];
type HistorialQuery = operations['listar_historial_global_historial__get']['parameters']['query'];
type AuditoriaQuery = operations['listar_logs_auditoria__get']['parameters']['query'];

// ========================
// AUTH
// ========================
export const authAPI = {
  login: (correo: string, password: string) =>
    client.post<LoginResponse>('/auth/login', { correo, password }),
  me: () => client.get<UserPublic>('/auth/me'),
};

// ========================
// USUARIOS
// ========================
export const usuariosAPI = {
  // Registro público (ciudadano)
  register: (data: RegistroUsuario) => client.post<RegistroResponse>('/usuarios/registro', data),
  registro: (data: RegistroUsuario) =>
    client.post<RegistroResponse>('/usuarios/registro', data), // alias
  // Perfil propio
  perfil: () => client.get<PerfilResponse>('/usuarios/perfil'),
  actualizarPerfil: (data: ActualizarPerfil) =>
    client.put<ActualizarPerfilResponse>('/usuarios/perfil', data),
  cambiarPassword: (data: CambiarPassword) =>
    client.put<CambiarPasswordResponse>('/usuarios/perfil/password', data),
  // Gestión (admin)
  listar: (params?: Record<string, unknown>) =>
    client.get<UsuarioListItem[]>('/usuarios/', { params }),
  detalle: (id: number) => client.get<UsuarioDetalleResponse>(`/usuarios/${id}`),
  cambiarEstado: (id: number, data: CambiarEstadoCuenta) =>
    client.put<CambiarEstadoUsuarioResponse>(`/usuarios/${id}/estado`, data),
};

// ========================
// REPORTES
// ========================
export const reportesAPI = {
  listar: (params?: ReportesQuery) => client.get<Reporte[]>('/reportes/', { params }),
  // GET /reportes/{id} devuelve la vista comunitaria reducida (sin
  // id_usuario/usuario) cuando un CIUDADANO consulta el reporte de otro --
  // ver backend/app/routers/reportes.py: obtener_reporte().
  obtener: (id: number) => client.get<Reporte | ReporteComunidad>(`/reportes/${id}`),
  crear: (data: ReporteCreateRequest) => client.post<CrearReporteResponse>('/reportes/', data),
  cambiarEstado: (id: number, data: CambiarEstadoRequest) =>
    client.put<CambiarEstadoResponse>(`/reportes/${id}/estado`, data),
  asignarEntidad: (id: number, data: AsignarEntidadRequest) =>
    client.put<CambiarEstadoResponse>(`/reportes/${id}/entidad`, data),
  mapa: () => client.get<ReporteMapaPunto[]>('/reportes/mapa'),
  estadisticas: () => client.get<EstadisticasResponse>('/reportes/estadisticas'),
  // Mismo criterio que obtener(): reducido para un CIUDADANO viendo el
  // historial de un reporte comunitario -- ver historial.py: historial_reporte().
  historial: (id: number) =>
    client.get<HistorialEntry[] | HistorialEntryComunidad[]>(`/reportes/${id}/historial`),
};

// ========================
// INFRAESTRUCTURA
// ========================
export const infraestructuraAPI = {
  listar: () => client.get<InfraestructuraItem[]>('/infraestructura/'),
  detalle: (id: number) => client.get<InfraestructuraItem>(`/infraestructura/${id}`),
  crear: (data: InfraestructuraCreate) =>
    client.post<CrearInfraestructuraResponse>('/infraestructura/', data),
  actualizar: (id: number, data: InfraestructuraUpdate) =>
    client.put<ActualizarInfraestructuraResponse>(`/infraestructura/${id}`, data),
};

// ========================
// NOTIFICACIONES
// ========================
export const notificacionesAPI = {
  listar: (soloNoLeidas = false) =>
    client.get<NotificacionItem[]>('/notificaciones/', {
      params: { solo_no_leidas: soloNoLeidas },
    }),
  marcarLeida: (id: number) => client.put<MarcarLeidaResponse>(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () =>
    client.put<MarcarTodasLeidasResponse>('/notificaciones/marcar-todas-leidas'),
};

// ========================
// HISTORIAL
// ========================
export const historialAPI = {
  listar: (params?: HistorialQuery) => client.get<HistorialEntry[]>('/historial/', { params }),
  porReporte: (id: number) => client.get<HistorialEntry[]>(`/reportes/${id}/historial`),
};

// ========================
// ENTIDADES
// ========================
export const entidadesAPI = {
  listar: (params?: Record<string, unknown>) =>
    client.get<EntidadDetalle[]>('/entidades/', { params }),
  detalle: (id: number) => client.get<EntidadDetalle>(`/entidades/${id}`),
  crear: (data: EntidadCreate) => client.post<CrearEntidadResponse>('/entidades/', data),
  actualizar: (id: number, data: EntidadUpdate) =>
    client.put<ActualizarEntidadResponse>(`/entidades/${id}`, data),
  cambiarEstado: (id: number, data: CambiarEstadoEntidad) =>
    client.put<CambiarEstadoEntidadResponse>(`/entidades/${id}/estado`, data),
  asignarUsuario: (eid: number, uid: number) =>
    client.put<AsignarUsuarioResponse>(`/entidades/${eid}/asignar-usuario/${uid}`),
  usuarios: (id: number) => client.get<UsuariosDeEntidadResponse>(`/entidades/${id}/usuarios`),
};

// ========================
// CATÁLOGOS
// ========================
export const catalogosAPI = {
  estadosReporte: () => client.get<EstadoReporteItem[]>('/catalogos/estado-reporte'),
  tiposIncidente: () => client.get<TipoIncidenteItem[]>('/catalogos/tipo-incidente'),
  severidades: () => client.get<SeveridadItem[]>('/catalogos/severidad'),
  categorias: () => client.get<CategoriaIncidenteItem[]>('/catalogos/categoria-incidente'),
};

// ========================
// AUDITORÍA
// ========================
export const auditoriaAPI = {
  listar: (params?: AuditoriaQuery) => client.get<ListarLogsResponse>('/auditoria/', { params }),
  modulos: () => client.get<ResumenModuloItem[]>('/auditoria/modulos'),
};

// ========================
// SIASAR (capa oficial de solo lectura -- ver backend/app/routers/siasar.py)
// ========================
export const siasarAPI = {
  municipios: () => client.get<MunicipioSiasar[]>('/siasar/municipios'),
  comunidadesMapa: (municipio: string) =>
    client.get<ComunidadMapa[]>('/siasar/comunidades/mapa', { params: { municipio } }),
  sistemasMapa: (municipio: string) =>
    client.get<SistemaMapa[]>('/siasar/sistemas/mapa', { params: { municipio } }),
  comunidad: (idSiasar: number) => client.get<ComunidadDetalle>(`/siasar/comunidades/${idSiasar}`),
  sistema: (idSiasar: number) => client.get<SistemaDetalle>(`/siasar/sistemas/${idSiasar}`),
  cercana: (lat: number, lon: number, radioM = 2000) =>
    client.get<CercanaResponse>('/siasar/cercana', { params: { lat, lon, radio_m: radioM } }),
  resumenMunicipios: () => client.get<ResumenMunicipio[]>('/siasar/resumen-municipios'),
};
