/**
 * Pruebas de UsuariosScreen (admin): carga y lista de usuarios, filtros
 * por estado, selección múltiple + acciones por lote (activar/suspender),
 * y la hoja de acción de una sola fila.
 *
 * No usa useFocusEffect ni useSafeAreaInsets -- se renderiza sin
 * NavigationContainer/SafeAreaProvider. AsyncStorage se mockea solo porque
 * useAuth()/AuthContext.tsx la importa al cargarse (no se usa Provider:
 * el valor por defecto del contexto es suficiente para esta pantalla).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import UsuariosScreen from '../screens/admin/UsuariosScreen';
import { usuariosAPI, solicitudesAccesoAPI } from '../api/services';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../api/services', () => ({
  usuariosAPI: { listar: jest.fn(), cambiarEstado: jest.fn() },
  solicitudesAccesoAPI: { listar: jest.fn() },
}));

const USUARIOS = [
  {
    id_usuario: 1, nombre_completo: 'Juan Activo', correo: 'juan@test.com', telefono: '300',
    ciudad: 'Zipaquirá', rol: 'CIUDADANO', estado_cuenta: 'ACTIVO', created_at: new Date().toISOString(),
  },
  {
    id_usuario: 2, nombre_completo: 'Pendiente Uno', correo: 'pendiente@demo.com', telefono: '301',
    ciudad: 'Zipaquirá', rol: 'ENTIDAD', estado_cuenta: 'PENDIENTE', created_at: new Date().toISOString(),
  },
  {
    id_usuario: 3, nombre_completo: 'Suspendido Uno', correo: 'suspendido@demo.com', telefono: '302',
    ciudad: 'Zipaquirá', rol: 'MODERADOR', estado_cuenta: 'SUSPENDIDO', created_at: new Date().toISOString(),
  },
];

function mockApisResueltas() {
  (usuariosAPI.listar as jest.Mock).mockResolvedValue({ data: USUARIOS });
  (solicitudesAccesoAPI.listar as jest.Mock).mockResolvedValue({ data: [] });
}

function renderComo(filter?: string) {
  const navigation = { navigate: jest.fn(), getParent: jest.fn(() => ({ navigate: jest.fn() })) } as any;
  const route = { params: filter ? { filter } : undefined } as any;
  return render(<UsuariosScreen navigation={navigation} route={route} />);
}

jest.setTimeout(15000);

beforeEach(() => {
  jest.clearAllMocks();
});

test('carga y muestra la lista de usuarios con el total en el badge', async () => {
  mockApisResueltas();
  renderComo();

  expect(await screen.findByText('Juan Activo')).toBeTruthy();
  expect(screen.getByText('Pendiente Uno')).toBeTruthy();
  expect(screen.getByText('Suspendido Uno')).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy(); // badge del header
});

test('muestra el estado de error con botón de reintentar', async () => {
  (usuariosAPI.listar as jest.Mock)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ data: USUARIOS });
  (solicitudesAccesoAPI.listar as jest.Mock).mockResolvedValue({ data: [] });

  renderComo();

  expect(await screen.findByText('No se pudo cargar')).toBeTruthy();
  fireEvent.press(screen.getByText('Reintentar'));

  expect(await screen.findByText('Juan Activo')).toBeTruthy();
});

test('el filtro "Pendientes" deja solo las cuentas pendientes', async () => {
  mockApisResueltas();
  renderComo();
  await screen.findByText('Juan Activo');

  fireEvent.press(screen.getByText('Pendientes'));

  expect(screen.getByText('Pendiente Uno')).toBeTruthy();
  expect(screen.queryByText('Juan Activo')).toBeNull();
  expect(screen.queryByText('Suspendido Uno')).toBeNull();
});

test('aplica el filtro inicial recibido por route.params', async () => {
  mockApisResueltas();
  renderComo('SUSPENDIDO');
  await screen.findByText('Suspendido Uno');

  expect(screen.queryByText('Juan Activo')).toBeNull();
  expect(screen.queryByText('Pendiente Uno')).toBeNull();
});

test('selección por lote: long-press selecciona, "Activar" cambia el estado de todos los marcados', async () => {
  mockApisResueltas();
  (usuariosAPI.cambiarEstado as jest.Mock).mockResolvedValue({ data: { message: 'ok' } });
  renderComo();
  await screen.findByText('Juan Activo');

  fireEvent(screen.getByText('Pendiente Uno'), 'longPress');
  fireEvent(screen.getByText('Suspendido Uno'), 'longPress');

  expect(screen.getByText('2 seleccionados')).toBeTruthy();

  fireEvent.press(screen.getByText('Activar'));

  await waitFor(() => {
    expect(usuariosAPI.cambiarEstado).toHaveBeenCalledWith(2, { id_estado_cuenta: 1 });
    expect(usuariosAPI.cambiarEstado).toHaveBeenCalledWith(3, { id_estado_cuenta: 1 });
  });
});

test('suspender por lote exige un motivo antes de confirmar', async () => {
  mockApisResueltas();
  (usuariosAPI.cambiarEstado as jest.Mock).mockResolvedValue({ data: { message: 'ok' } });
  renderComo();
  await screen.findByText('Juan Activo');

  fireEvent(screen.getByText('Juan Activo'), 'longPress');
  fireEvent.press(screen.getByText('Suspender'));

  // El modal trae su propio botón "Suspender" (el último en el árbol) --
  // disabled={!motivo.trim()} lo deja sin efecto mientras esté vacío.
  fireEvent.press(screen.getAllByText('Suspender')[screen.getAllByText('Suspender').length - 1]);
  expect(usuariosAPI.cambiarEstado).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByPlaceholderText('Motivo (obligatorio)'), 'Incumplimiento');
  fireEvent.press(screen.getAllByText('Suspender')[screen.getAllByText('Suspender').length - 1]);

  await waitFor(() => {
    expect(usuariosAPI.cambiarEstado).toHaveBeenCalledWith(1, { id_estado_cuenta: 3 });
  });
});

test('tocar una cuenta pendiente (sin selección) abre la hoja y permite activarla', async () => {
  mockApisResueltas();
  (usuariosAPI.cambiarEstado as jest.Mock).mockResolvedValue({ data: { message: 'ok' } });
  renderComo();
  await screen.findByText('Juan Activo');

  fireEvent.press(screen.getByText('Pendiente Uno'));

  expect(await screen.findByText(/pendiente de activación/)).toBeTruthy();
  fireEvent.press(screen.getByText('Activar'));

  await waitFor(() => {
    expect(usuariosAPI.cambiarEstado).toHaveBeenCalledWith(2, { id_estado_cuenta: 1 });
  });
});
