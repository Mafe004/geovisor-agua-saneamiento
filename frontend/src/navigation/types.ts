import type { Reporte } from '../types/domain';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  CiudadanoHome: undefined;
  EntidadHome: undefined;
  ModeradorHome: undefined;
  AdminHome: undefined;
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
