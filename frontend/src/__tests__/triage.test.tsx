/**
 * Pruebas de TriageScreen (moderador): la bandeja de reportes a triar --
 * carga, filtros (sin revisar / sin entidad / alta), búsqueda, estados de
 * error/vacío, y que tocar un reporte abra TriageSheet con ese reporte.
 *
 * TriageSheet se mockea por completo: su propia lógica (asignar entidad,
 * cambiar estado) no es parte de este archivo -- aquí solo importa que
 * TriageScreen se la pase correctamente.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react-native';

import TriageScreen from '../screens/moderador/TriageScreen';
import { reportesAPI, catalogosAPI, entidadesAPI } from '../api/services';

// useFocusEffect exige un NavigationContainer, y AndiHeader usa
// useSafeAreaInsets() -- ambos los provee App.js de verdad (ver App.js);
// se reconstruye el mismo anidamiento mínimo acá.
function render(ui: React.ReactElement) {
  return rtlRender(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <NavigationContainer>{ui}</NavigationContainer>
    </SafeAreaProvider>,
  );
}

jest.mock('../api/services', () => ({
  reportesAPI: { listar: jest.fn() },
  catalogosAPI: { estadosReporte: jest.fn() },
  entidadesAPI: { listar: jest.fn() },
}));

jest.mock('../screens/moderador/TriageSheet', () => {
  const { Text } = require('react-native');
  return function MockTriageSheet(props: { visible: boolean; reporte: { id_reporte: number } | null }) {
    if (!props.visible) return null;
    return <Text testID="triage-sheet">{`sheet-abierto-${props.reporte?.id_reporte}`}</Text>;
  };
});

const REPORTES = [
  {
    id_reporte: 1, descripcion: 'Fuga en la calle 10', direccion: 'Calle 10', usuario: 'Juan',
    estado: 'PENDIENTE', severidad: 'MEDIA', id_entidad: null, tipo_incidente: 'Fuga de agua',
    created_at: new Date().toISOString(),
  },
  {
    id_reporte: 2, descripcion: 'Taponamiento grave', direccion: 'Av. Siempre Viva', usuario: 'Ana',
    estado: 'EN_REVISION', severidad: 'ALTA', id_entidad: 1, entidad_sugerida: 'Acueducto',
    tipo_incidente: 'Taponamiento', created_at: new Date().toISOString(),
  },
];

function mockApisResueltos() {
  (reportesAPI.listar as jest.Mock).mockResolvedValue({ data: REPORTES });
  (catalogosAPI.estadosReporte as jest.Mock).mockResolvedValue({ data: [] });
  (entidadesAPI.listar as jest.Mock).mockResolvedValue({ data: [] });
}

jest.setTimeout(15000);

beforeEach(() => {
  jest.clearAllMocks();
});

test('carga y muestra los reportes de la bandeja', async () => {
  mockApisResueltos();
  render(<TriageScreen />);

  expect(await screen.findByText('Fuga en la calle 10')).toBeTruthy();
  expect(screen.getByText('Taponamiento grave')).toBeTruthy();
  expect(reportesAPI.listar).toHaveBeenCalledWith({ solo_activos: true });
});

test('muestra el estado de error con botón de reintentar', async () => {
  (reportesAPI.listar as jest.Mock)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ data: REPORTES });
  (catalogosAPI.estadosReporte as jest.Mock).mockResolvedValue({ data: [] });
  (entidadesAPI.listar as jest.Mock).mockResolvedValue({ data: [] });

  render(<TriageScreen />);

  expect(await screen.findByText('No se pudo cargar')).toBeTruthy();
  fireEvent.press(screen.getByText('Reintentar'));

  expect(await screen.findByText('Fuga en la calle 10')).toBeTruthy();
  expect(reportesAPI.listar).toHaveBeenCalledTimes(2);
});

test('el filtro "Sin entidad" deja solo los reportes sin entidad asignada', async () => {
  mockApisResueltos();
  render(<TriageScreen />);
  await screen.findByText('Fuga en la calle 10');

  // El chip trae el conteo ("Sin entidad · 1"); la insignia que muestra la
  // propia tarjeta del reporte #1 dice solo "Sin entidad" -- el texto con
  // el conteo es inequívocamente el chip.
  fireEvent.press(screen.getByText('Sin entidad · 1'));

  expect(screen.getByText('Fuga en la calle 10')).toBeTruthy();
  expect(screen.queryByText('Taponamiento grave')).toBeNull();
});

test('el filtro "Alta" deja solo los reportes de severidad alta o crítica', async () => {
  mockApisResueltos();
  render(<TriageScreen />);
  await screen.findByText('Fuga en la calle 10');

  // "Alta" también puede aparecer como chip de severidad en la propia
  // tarjeta -- el chip de filtro es el primero en el árbol (chipsRow se
  // pinta antes que la lista).
  fireEvent.press(screen.getAllByText('Alta')[0]);

  expect(screen.getByText('Taponamiento grave')).toBeTruthy();
  expect(screen.queryByText('Fuga en la calle 10')).toBeNull();
});

test('la búsqueda filtra por descripción/dirección/ciudadano/tipo', async () => {
  mockApisResueltos();
  render(<TriageScreen />);
  await screen.findByText('Fuga en la calle 10');

  fireEvent.press(screen.getByLabelText('Buscar'));
  fireEvent.changeText(
    screen.getByPlaceholderText('Buscar por descripción, dirección o ciudadano…'),
    'ana',
  );

  expect(screen.getByText('Taponamiento grave')).toBeTruthy();
  expect(screen.queryByText('Fuga en la calle 10')).toBeNull();
});

test('muestra un estado vacío cuando la búsqueda no coincide con nada', async () => {
  mockApisResueltos();
  render(<TriageScreen />);
  await screen.findByText('Fuga en la calle 10');

  fireEvent.press(screen.getByLabelText('Buscar'));
  fireEvent.changeText(
    screen.getByPlaceholderText('Buscar por descripción, dirección o ciudadano…'),
    'texto que no existe en ningún reporte',
  );

  expect(await screen.findByText('Sin resultados')).toBeTruthy();
});

test('tocar un reporte abre TriageSheet con ese reporte', async () => {
  mockApisResueltos();
  render(<TriageScreen />);
  await screen.findByText('Fuga en la calle 10');

  fireEvent.press(screen.getByText('Fuga en la calle 10'));

  await waitFor(() => {
    expect(screen.getByTestId('triage-sheet').props.children).toBe('sheet-abierto-1');
  });
});
