import type { Reporte, ReporteComunidad } from '../types/domain';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  CiudadanoHome: undefined;
  EntidadHome: undefined;
  ModeradorHome: undefined;
  AdminHome: undefined;
  // ReporteComunidad: solo llega aquí desde el Mapa/Detalle de Ciudadano,
  // cuando el reporte abierto es de otro usuario (vista comunitaria, sin
  // id_usuario/usuario -- ver reportesAPI.obtener en api/services.ts).
  // Entidad/Moderador/Administrador solo navegan aquí con un Reporte
  // completo, nunca con la vista reducida.
  DetalleReporte: { reporte: Reporte | ReporteComunidad };
};

// Tabs de CiudadanoTabs (AppNavigator.tsx) -- ciudadano y entidad navegan
// entre tabs hermanos por nombre (navigation.navigate('Crear'), ('Reportes')
// / ('Asignados')), así que son los únicos grupos de tabs que necesitan su
// propio ParamList; el resto de los roles solo navegan hacia arriba, a
// DetalleReporte en el stack raíz.
export type CiudadanoTabParamList = {
  Mapa: undefined;
  Reportes: undefined;
  // draftId opcional: permite reanudar un borrador local guardado con
  // utils/offlineDrafts.ts (ver MisReportesScreen -> "Seguir").
  Crear: { draftId?: string } | undefined;
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
