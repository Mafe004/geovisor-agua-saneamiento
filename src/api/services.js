import client from './client';

// ========================
// AUTH
// ========================
export const authAPI = {
  login:  (correo, password) => client.post('/auth/login', { correo, password }),
  me:     () => client.get('/auth/me'),
};

// ========================
// USUARIOS
// ========================
export const usuariosAPI = {
  // Registro público (ciudadano)
  register:        (data)     => client.post('/usuarios/registro', data),
  registro:        (data)     => client.post('/usuarios/registro', data), // alias
  // Perfil propio
  perfil:          ()         => client.get('/usuarios/perfil'),
  actualizarPerfil:(data)     => client.put('/usuarios/perfil', data),
  cambiarPassword: (data)     => client.put('/usuarios/perfil/password', data),
  // Gestión (admin)
  listar:          (params)   => client.get('/usuarios/', { params }),
  detalle:         (id)       => client.get(`/usuarios/${id}`),
  toggleEstado:    (id)       => client.put(`/usuarios/${id}/toggle-estado`),
  cambiarEstado:   (id, data) => client.put(`/usuarios/${id}/estado`, data),
};

// ========================
// REPORTES
// ========================
export const reportesAPI = {
  listar:       (params)      => client.get('/reportes/', { params }),
  obtener:      (id)          => client.get(`/reportes/${id}`),
  crear:        (data)        => client.post('/reportes/', data),
  cambiarEstado:(id, data)    => client.put(`/reportes/${id}/estado`, data),
  mapa:         ()            => client.get('/reportes/mapa'),
  estadisticas: ()            => client.get('/reportes/estadisticas'),
  historial:    (id)          => client.get(`/reportes/${id}/historial`),
};

// ========================
// INFRAESTRUCTURA
// ========================
export const infraestructuraAPI = {
  listar:    ()          => client.get('/infraestructura/'),
  detalle:   (id)        => client.get(`/infraestructura/${id}`),
  crear:     (data)      => client.post('/infraestructura/', data),
  actualizar:(id, data)  => client.put(`/infraestructura/${id}`, data),
};

// ========================
// NOTIFICACIONES
// ========================
export const notificacionesAPI = {
  listar:           (soloNoLeidas = false) =>
                      client.get('/notificaciones/', { params: { solo_no_leidas: soloNoLeidas } }),
  marcarLeida:      (id) => client.put(`/notificaciones/${id}/leer`),
  marcarTodasLeidas:()   => client.put('/notificaciones/marcar-todas-leidas'),
};

// ========================
// HISTORIAL
// ========================
export const historialAPI = {
  listar:     (params) => client.get('/historial/', { params }),
  porReporte: (id)     => client.get(`/reportes/${id}/historial`),
};

// ========================
// ENTIDADES
// ========================
export const entidadesAPI = {
  listar:        (params)        => client.get('/entidades/', { params }),
  detalle:       (id)            => client.get(`/entidades/${id}`),
  crear:         (data)          => client.post('/entidades/', data),
  actualizar:    (id, data)      => client.put(`/entidades/${id}`, data),
  cambiarEstado: (id, activo)    => client.put(`/entidades/${id}/estado`, { activo }),
  asignarUsuario:(eid, uid)      => client.put(`/entidades/${eid}/asignar-usuario/${uid}`),
  usuarios:      (id)            => client.get(`/entidades/${id}/usuarios`),
};

// ========================
// CATÁLOGOS
// ========================
export const catalogosAPI = {
  estadosReporte:  () => client.get('/catalogos/estado-reporte'),
  tiposIncidente:  () => client.get('/catalogos/tipo-incidente'),
  severidades:     () => client.get('/catalogos/severidad'),
  categorias:      () => client.get('/catalogos/categoria-incidente'),
};

// ========================
// AUDITORÍA
// ========================
export const auditoriaAPI = {
  listar:  (params) => client.get('/auditoria/', { params }),
  modulos: ()       => client.get('/auditoria/modulos'),
};
