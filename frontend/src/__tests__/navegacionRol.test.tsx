/**
 * Pruebas de AppNavigator: qué stack/tabs monta según el rol del usuario
 * (CIUDADANO=1, ENTIDAD=2, MODERADOR=3, ADMINISTRADOR=4), más el estado de
 * carga y sin sesión. Cada pantalla real se mockea a un <Text> con una
 * etiqueta única -- esto no prueba el contenido de cada pantalla (eso ya
 * lo hacen sus propios archivos de test), solo que AppNavigator cablea el
 * rol correcto al tab navigator correcto y que los tabs navegan.
 */
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, screen, fireEvent } from '@testing-library/react-native';

import AppNavigator from '../navigation/AppNavigator';
import { AuthContext } from '../context/AuthContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function mockScreenFactory(label: string) {
  return function MockScreen() {
    return <Text>{label}</Text>;
  };
}

jest.mock('../screens/auth/LoginScreen', () => mockScreenFactory('pantalla-login'));
jest.mock('../screens/auth/RegisterScreen', () => mockScreenFactory('pantalla-register'));
jest.mock('../screens/auth/InvitacionScreen', () => mockScreenFactory('pantalla-invitacion'));
jest.mock('../screens/auth/SolicitarAccesoScreen', () => mockScreenFactory('pantalla-solicitar-acceso'));
jest.mock('../screens/auth/CuentaSuspendidaScreen', () => mockScreenFactory('pantalla-cuenta-suspendida'));
jest.mock('../screens/auth/TelefonoOpcionalScreen', () => mockScreenFactory('pantalla-telefono-opcional'));
jest.mock('../screens/auth/ForgotPasswordScreen', () => mockScreenFactory('pantalla-forgot-password'));
jest.mock('../screens/auth/NuevaContrasenaScreen', () => mockScreenFactory('pantalla-nueva-contrasena'));

jest.mock('../screens/shared/PerfilScreen', () => mockScreenFactory('pantalla-perfil-compartido'));

jest.mock('../screens/ciudadano/MapaScreen', () => mockScreenFactory('pantalla-mapa-ciudadano'));
jest.mock('../screens/ciudadano/MisReportesScreen', () => mockScreenFactory('pantalla-mis-reportes'));
jest.mock('../screens/ciudadano/CrearReporteScreen', () => mockScreenFactory('pantalla-crear-ciudadano'));
jest.mock('../screens/ciudadano/NotificacionesScreen', () => mockScreenFactory('pantalla-notificaciones'));
jest.mock('../screens/ciudadano/PerfilScreen', () => mockScreenFactory('pantalla-perfil-ciudadano'));
jest.mock('../screens/ciudadano/DetalleReporteScreen', () => mockScreenFactory('pantalla-detalle-ciudadano'));

jest.mock('../screens/entidad/ReportesAsignadosScreen', () => mockScreenFactory('pantalla-asignados'));
jest.mock('../screens/entidad/DetalleReporteScreen', () => mockScreenFactory('pantalla-detalle-entidad'));
jest.mock('../screens/entidad/CrearReporteScreen', () => mockScreenFactory('pantalla-crear-entidad'));
jest.mock('../screens/entidad/CifrasEntidadScreen', () => mockScreenFactory('pantalla-cifras'));
jest.mock('../screens/entidad/MapaEntidadScreen', () => mockScreenFactory('pantalla-mapa-entidad'));

jest.mock('../screens/moderador/TodosReportesScreen', () => mockScreenFactory('pantalla-todos-reportes'));
jest.mock('../screens/moderador/HistorialScreen', () => mockScreenFactory('pantalla-historial'));
jest.mock('../screens/moderador/TriageScreen', () => mockScreenFactory('pantalla-triage'));
jest.mock('../screens/moderador/InfraestructuraScreen', () => mockScreenFactory('pantalla-infraestructura'));

jest.mock('../screens/admin/DashboardScreen', () => mockScreenFactory('pantalla-dashboard'));
jest.mock('../screens/admin/UsuariosScreen', () => mockScreenFactory('pantalla-usuarios'));
jest.mock('../screens/admin/EntidadesScreen', () => mockScreenFactory('pantalla-entidades'));
jest.mock('../screens/admin/AuditoriaScreen', () => mockScreenFactory('pantalla-auditoria'));
jest.mock('../screens/admin/AdminPerfilScreen', () => mockScreenFactory('pantalla-admin-perfil'));
jest.mock('../screens/admin/SolicitudesAccesoScreen', () => mockScreenFactory('pantalla-solicitudes-acceso'));

function renderComo(user: Record<string, unknown> | null, loading = false) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AuthContext.Provider value={{ user, loading } as any}>
        <AppNavigator />
      </AuthContext.Provider>
    </SafeAreaProvider>,
  );
}

jest.setTimeout(15000);

test('mientras loading=true, muestra la pantalla de carga (nunca un stack de rol)', () => {
  renderComo(null, true);
  expect(screen.getByText('Iniciando GeoVisor…')).toBeTruthy();
  expect(screen.queryByText('pantalla-login')).toBeNull();
});

test('sin sesión, muestra el stack de autenticación (Login)', async () => {
  renderComo(null);
  expect(await screen.findByText('pantalla-login')).toBeTruthy();
});

test('CIUDADANO (id_rol=1): tabs Mapa/Reportes/Avisos/Perfil, navega entre ellos', async () => {
  renderComo({ id_usuario: 1, id_rol: 1 });

  expect(await screen.findByText('pantalla-mapa-ciudadano')).toBeTruthy();

  fireEvent.press(screen.getByText('Avisos'));
  expect(await screen.findByText('pantalla-notificaciones')).toBeTruthy();

  fireEvent.press(screen.getByText('Perfil'));
  expect(await screen.findByText('pantalla-perfil-ciudadano')).toBeTruthy();
});

test('MODERADOR (id_rol=3): tabs Triage/Historial/Infra/Perfil, navega entre ellos', async () => {
  renderComo({ id_usuario: 3, id_rol: 3 });

  expect(await screen.findByText('pantalla-triage')).toBeTruthy();

  fireEvent.press(screen.getByText('Infra'));
  expect(await screen.findByText('pantalla-infraestructura')).toBeTruthy();

  fireEvent.press(screen.getByText('Historial'));
  expect(await screen.findByText('pantalla-historial')).toBeTruthy();
});

test('ENTIDAD (id_rol=2, trabajador): tabs Asignados/Cifras/Crear/Historial/Mapa, navega entre ellos', async () => {
  renderComo({ id_usuario: 2, id_rol: 2, id_entidad: 1, es_titular_entidad: false });

  expect(await screen.findByText('pantalla-asignados')).toBeTruthy();

  fireEvent.press(screen.getByText('Cifras'));
  expect(await screen.findByText('pantalla-cifras')).toBeTruthy();

  fireEvent.press(screen.getByText('Mapa'));
  expect(await screen.findByText('pantalla-mapa-entidad')).toBeTruthy();
});

test('ADMINISTRADOR (id_rol=4): tabs Panel/Reportes/Usuarios/Entidades/Auditoría, navega entre ellos', async () => {
  renderComo({ id_usuario: 5, id_rol: 4 });

  expect(await screen.findByText('pantalla-dashboard')).toBeTruthy();

  fireEvent.press(screen.getByText('Usuarios'));
  expect(await screen.findByText('pantalla-usuarios')).toBeTruthy();

  fireEvent.press(screen.getByText('Entidades'));
  expect(await screen.findByText('pantalla-entidades')).toBeTruthy();

  fireEvent.press(screen.getByText('Auditoría'));
  expect(await screen.findByText('pantalla-auditoria')).toBeTruthy();
});
