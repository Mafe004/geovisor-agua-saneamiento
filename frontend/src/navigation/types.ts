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
