/**
 * Pruebas de AuthContext/AuthProvider: arranque (revalida sesión guardada
 * contra /auth/me), login, logout, y los dos caminos de fallo al revalidar
 * -- 401/403 (token ya no vale -> cierra sesión) vs sin respuesta del
 * servidor (red caída -> conserva la sesión cacheada).
 *
 * Se usa un consumidor mínimo (no una pantalla real) para ejercitar
 * useAuth() directamente, sin depender de ninguna pantalla de UI.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { authAPI } from '../api/services';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../api/services', () => ({
  authAPI: { login: jest.fn(), me: jest.fn() },
}));

const USER = { id_usuario: 1, nombre_completo: 'Juan Pérez', correo: 'juan@test.com', id_rol: 1 };

function Consumidor() {
  const { user, token, loading, login, logout } = useAuth();
  return (
    <>
      <Text>{loading ? 'cargando' : 'listo'}</Text>
      <Text>{user ? `sesion:${user.correo}` : 'sin-sesion'}</Text>
      <Text>{token ? `token:${token}` : 'sin-token'}</Text>
      <TouchableOpacity onPress={() => login('juan@test.com', 'demo2025')}>
        <Text>Entrar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => logout()}>
        <Text>Salir</Text>
      </TouchableOpacity>
    </>
  );
}

function renderConsumidor() {
  return render(<AuthProvider><Consumidor /></AuthProvider>);
}

jest.setTimeout(15000);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('arranca sin sesión cuando no hay nada guardado', async () => {
  renderConsumidor();

  await screen.findByText('listo');
  expect(screen.getByText('sin-sesion')).toBeTruthy();
  expect(authAPI.me).not.toHaveBeenCalled();
});

test('login guarda el token/usuario y actualiza el contexto', async () => {
  (authAPI.login as jest.Mock).mockResolvedValue({
    data: { access_token: 'tok-123', user: USER },
  });
  renderConsumidor();
  await screen.findByText('listo');

  fireEvent.press(screen.getByText('Entrar'));

  await screen.findByText('sesion:juan@test.com');
  expect(screen.getByText('token:tok-123')).toBeTruthy();
  expect(await AsyncStorage.getItem('token')).toBe('tok-123');
  expect(JSON.parse((await AsyncStorage.getItem('user')) ?? 'null')).toEqual(USER);
});

test('logout limpia AsyncStorage y el estado del contexto', async () => {
  (authAPI.login as jest.Mock).mockResolvedValue({
    data: { access_token: 'tok-123', user: USER },
  });
  renderConsumidor();
  await screen.findByText('listo');
  fireEvent.press(screen.getByText('Entrar'));
  await screen.findByText('sesion:juan@test.com');

  fireEvent.press(screen.getByText('Salir'));

  await screen.findByText('sin-sesion');
  expect(screen.getByText('sin-token')).toBeTruthy();
  expect(await AsyncStorage.getItem('token')).toBeNull();
  expect(await AsyncStorage.getItem('user')).toBeNull();
});

test('con sesión guardada, revalida contra /auth/me y refresca el usuario', async () => {
  await AsyncStorage.setItem('token', 'tok-viejo');
  await AsyncStorage.setItem('user', JSON.stringify({ ...USER, nombre_completo: 'Nombre Viejo' }));
  const userFresco = { ...USER, nombre_completo: 'Nombre Fresco' };
  (authAPI.me as jest.Mock).mockResolvedValue({ data: userFresco });

  renderConsumidor();

  await screen.findByText('sesion:juan@test.com');
  expect(screen.getByText('token:tok-viejo')).toBeTruthy();
  expect(JSON.parse((await AsyncStorage.getItem('user')) ?? 'null')).toEqual(userFresco);
});

test('si /auth/me responde 401/403, cierra la sesión (token ya no vale)', async () => {
  await AsyncStorage.setItem('token', 'tok-viejo');
  await AsyncStorage.setItem('user', JSON.stringify(USER));
  (authAPI.me as jest.Mock).mockRejectedValue({
    isAxiosError: true,
    response: { status: 401 },
  });

  renderConsumidor();

  await screen.findByText('sin-sesion');
  await waitFor(async () => expect(await AsyncStorage.getItem('token')).toBeNull());
});

test('si /auth/me no responde (red caída), conserva la sesión cacheada', async () => {
  await AsyncStorage.setItem('token', 'tok-viejo');
  await AsyncStorage.setItem('user', JSON.stringify(USER));
  (authAPI.me as jest.Mock).mockRejectedValue({ isAxiosError: true, response: undefined });

  renderConsumidor();

  await screen.findByText('sesion:juan@test.com');
  expect(screen.getByText('token:tok-viejo')).toBeTruthy();
  expect(await AsyncStorage.getItem('token')).toBe('tok-viejo');
});
