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

// Tabs de CiudadanoTabs (AppNavigator.tsx) -- solo ciudadano/ navega entre
// tabs hermanos por nombre (navigation.navigate('Crear'), ('Reportes')),
// así que es el único grupo de tabs que necesita su propio ParamList; el
// resto de los roles solo navegan hacia arriba, a DetalleReporte en el
// stack raíz.
export type CiudadanoTabParamList = {
  Mapa: undefined;
  Reportes: undefined;
  Crear: undefined;
  Notificaciones: undefined;
  Perfil: undefined;
};
