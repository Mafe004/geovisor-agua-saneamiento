/**
 * Pruebas de InfraestructuraScreen (moderador): carga y lista de puntos de
 * infraestructura hídrica, filtro por tipo, estados de error/vacío, y el
 * formulario de creación (validación de campos requeridos + alta
 * exitosa).
 *
 * MapaWebView se mockea -- es un WebView real (Leaflet/Google Maps), no
 * algo que tenga sentido montar en Jest; la única interacción que le
 * importa a este archivo es onCenterChange, que el mock expone como un
 * botón presionable.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react-native';

import InfraestructuraScreen from '../screens/moderador/InfraestructuraScreen';
import { infraestructuraAPI } from '../api/services';
import { ToastProvider } from '../components/andi/Toast';

jest.mock('../api/services', () => ({
  infraestructuraAPI: { listar: jest.fn(), crear: jest.fn() },
}));

jest.mock('../components/MapaWebView', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return function MockMapaWebView({ onCenterChange }: { onCenterChange?: (c: { latitude: number; longitude: number }) => void }) {
    if (!onCenterChange) return null;
    return (
      <TouchableOpacity testID="mock-mapa-centro" onPress={() => onCenterChange({ latitude: 5.03, longitude: -74.01 })}>
        <Text>mapa-mock</Text>
      </TouchableOpacity>
    );
  };
});

function render(ui: React.ReactElement) {
  return rtlRender(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <NavigationContainer>
        <ToastProvider>{ui}</ToastProvider>
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

const ITEMS = [
  {
    id_infraestructura: 1, nombre: 'PTAR El Espino', tipo: 'PTAR', estado: 'ACTIVA',
    fuente: 'SIASAR', latitud: 5.0231, longitud: -74.0041,
  },
  {
    id_infraestructura: 2, nombre: 'Pozo Barandillas', tipo: 'POZO', estado: 'INACTIVA',
    fuente: null, latitud: 5.03, longitud: -74.0,
  },
];

function mockListarResuelto(items = ITEMS) {
  (infraestructuraAPI.listar as jest.Mock).mockResolvedValue({ data: items });
}

jest.setTimeout(15000);

beforeEach(() => {
  jest.clearAllMocks();
});

test('carga y muestra los puntos de infraestructura', async () => {
  mockListarResuelto();
  render(<InfraestructuraScreen />);

  expect(await screen.findByText('PTAR El Espino')).toBeTruthy();
  expect(screen.getByText('Pozo Barandillas')).toBeTruthy();
  expect(infraestructuraAPI.listar).toHaveBeenCalled();
});

test('muestra el estado de error con botón de reintentar', async () => {
  (infraestructuraAPI.listar as jest.Mock)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ data: ITEMS });

  render(<InfraestructuraScreen />);

  expect(await screen.findByText('No se pudo cargar')).toBeTruthy();
  fireEvent.press(screen.getByText('Reintentar'));

  expect(await screen.findByText('PTAR El Espino')).toBeTruthy();
  expect(infraestructuraAPI.listar).toHaveBeenCalledTimes(2);
});

test('el filtro por tipo deja solo los puntos de ese tipo', async () => {
  mockListarResuelto();
  render(<InfraestructuraScreen />);
  await screen.findByText('PTAR El Espino');

  // "Pozo" también puede leerse en la propia tarjeta ("Pozo · ..."); el
  // chip de filtro es el primero en el árbol (chipsRow se pinta antes que
  // la lista).
  fireEvent.press(screen.getAllByText('Pozo')[0]);

  expect(screen.getByText('Pozo Barandillas')).toBeTruthy();
  expect(screen.queryByText('PTAR El Espino')).toBeNull();
});

test('muestra un estado vacío cuando no hay infraestructura', async () => {
  mockListarResuelto([]);
  render(<InfraestructuraScreen />);

  expect(await screen.findByText('Sin infraestructura registrada')).toBeTruthy();
});

test('el formulario valida los campos requeridos antes de llamar a crear', async () => {
  mockListarResuelto();
  render(<InfraestructuraScreen />);
  await screen.findByText('PTAR El Espino');

  fireEvent.press(screen.getByLabelText('Nueva infraestructura'));
  await screen.findByText('Nueva infraestructura');

  fireEvent.press(screen.getByText('Guardar'));

  expect(await screen.findByText('Ingresa un nombre.')).toBeTruthy();
  expect(infraestructuraAPI.crear).not.toHaveBeenCalled();
});

test('crea una infraestructura con los datos del formulario y recarga la lista', async () => {
  mockListarResuelto();
  (infraestructuraAPI.crear as jest.Mock).mockResolvedValue({
    data: { infraestructura: { ...ITEMS[0], id_infraestructura: 3, nombre: 'Embalse Nuevo' } },
  });
  render(<InfraestructuraScreen />);
  await screen.findByText('PTAR El Espino');

  fireEvent.press(screen.getByLabelText('Nueva infraestructura'));
  await screen.findByText('Nueva infraestructura');

  fireEvent.changeText(screen.getByPlaceholderText('Ej: PTAR El Espino'), 'Embalse Nuevo');
  // El chip de tipo DENTRO del formulario usa la etiqueta en mayúsculas
  // ("EMBALSE") -- la lista de fondo (detrás del modal, todavía montada)
  // tiene su propio chip de filtro "Embalse" con mayúscula inicial nomás.
  fireEvent.press(screen.getByText('EMBALSE'));
  fireEvent.press(screen.getByTestId('mock-mapa-centro'));
  fireEvent.press(screen.getByText('Guardar'));

  await waitFor(() => {
    expect(infraestructuraAPI.crear).toHaveBeenCalledWith({
      nombre: 'Embalse Nuevo',
      tipo: 'EMBALSE',
      latitud: 5.03,
      longitud: -74.01,
      fuente: null,
      estado: 'ACTIVA',
    });
  });
  // onCreated() cierra el modal y recarga la lista en segundo plano.
  await waitFor(() => expect(infraestructuraAPI.listar).toHaveBeenCalledTimes(2));
});
