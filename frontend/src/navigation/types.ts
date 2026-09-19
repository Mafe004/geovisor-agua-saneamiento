import type { Reporte } from '../types/domain';

export type RootStackParamList = {
  Login: { successMessage?: string } | undefined;
  Register: { id_rol: number; codigoData?: { codigo: string; rol?: string; entidad?: string } };
  // New Auth-flow routes (Phase 1 scaffold; screens land in Phases 3/4/6).
  Invitacion: undefined;
  CuentaSuspendida: { message?: string };
  TelefonoOpcional: { userId: number };
  ForgotPassword: undefined;
  // Nombre en minúsculas/guiones a propósito, a diferencia de toda otra ruta
  // de este ParamList: sin un `linking` prop explícito en AppNavigator,
  // React Navigation deriva el path web del nombre de ruta tal cual, y el
  // correo de restablecimiento (app/services/email_service.py, backend)
  // apunta literal a "{FRONTEND_URL}/nueva-contrasena?token=..." -- el
  // nombre de ruta ES el path público, así que tiene que coincidir exacto.
  'nueva-contrasena': { token?: string } | undefined;
  CiudadanoHome: undefined;
  EntidadHome: undefined;
  ModeradorHome: undefined;
  AdminHome: undefined;
  // Admin profile, reached from the Dashboard header avatar (not a tab).
  AdminPerfil: undefined;
  DetalleReporte: { reporte: Reporte };
};

// Tabs de CiudadanoTabs (AppNavigator.tsx) -- ciudadano y entidad navegan
// entre tabs hermanos por nombre (navigation.navigate('Crear'), ('Reportes')
// / ('Asignados')), así que son los únicos grupos de tabs que necesitan su
// propio ParamList; el resto de los roles solo navegan hacia arriba, a
// DetalleReporte en el stack raíz.
export type CiudadanoTabParamList = {
  Mapa: undefined;
  Reportes: undefined;
  Crear: undefined;
  Notificaciones: undefined;
  Perfil: undefined;
};

export type EntidadTabParamList = {
  Asignados: undefined;
  Cifras: undefined;
  Crear: undefined;
  Historial: undefined;
  Mapa: undefined;
  Perfil: undefined;
};

// AdminTabs (AppNavigator.tsx) -- DashboardScreen's "Revisarlas" button jumps
// to the sibling Usuarios tab with a filter param, same sibling-navigation
// need as the ParamLists above.
export type AdminTabParamList = {
  Panel: undefined;
  Reportes: undefined;
  Usuarios: { filter?: string } | undefined;
  Entidades: undefined;
  Auditoría: undefined;
};
