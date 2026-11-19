/**
 * Pruebas de ReportesAsignadosScreen (entidad): la lista de reportes
 * asignados a la entidad del usuario -- carga, el guardia de "sin
 * id_entidad", filtros (abiertos/alta/cerrados), la vista "Mis
 * reportes"/"Equipo" (solo para el titular), y la acción "Tomar" de un
 * trabajador normal.
 *
 * AsignarTrabajadorModal se mockea -- su propia lógica de asignación no es
 * parte de este archivo.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react-native';

import ReportesAsignadosScreen from '../screens/entidad/ReportesAsignadosScreen';
import { reportesAPI, catalogosAPI, entidadesAPI } from '../api/services';
import { AuthContext } from '../context/AuthContext';
import { ToastProvider } from '../components/andi/Toast';

// AuthContext.tsx importa AsyncStorage (logout()); su módulo nativo no
// existe en el entorno de Jest -- se usa el mock oficial del paquete.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../api/services', () => ({
  reportesAPI: { listar: jest.fn(), cambiarEstado: jest.fn(), asignarUsuario: jest.fn() },
  catalogosAPI: { estadosReporte: jest.fn() },
  entidadesAPI: { listar: jest.fn(), detalle: jest.fn() },
}));

jest.mock('../components/andi/AsignarTrabajadorModal', () => {
  const { Text } = require('react-native');
  return function MockAsignarTrabajadorModal({ visible }: { visible: boolean }) {
    return visible ? <Text testID="asignar-modal">asignar-modal-abierto</Text> : null;
  };
});

const TRABAJADOR = {
  id_usuario: 10, id_entidad: 1, es_titular_entidad: false, nombre_completo: 'Trabajador Uno',
};
const TITULAR = {
  id_usuario: 20, id_entidad: 1, es_titular_entidad: true, nombre_completo: 'Titular Uno',
};

const REPORTES = [
  {
    id_reporte: 1, descripcion: 'Fuga asignada a mí', direccion: 'Calle 1', usuario: 'Juan',
    estado: 'PENDIENTE', severidad: 'MEDIA', id_usuario_asignado: 10, usuario_asignado: 'Trabajador Uno',
    created_at: new Date().toISOString(),
  },
  {
    id_reporte: 2, descripcion: 'Reporte del pool sin tomar', direccion: 'Calle 2', usuario: 'Ana',
    estado: 'PENDIENTE', severidad: 'ALTA', id_usuario_asignado: null, usuario_asignado: null,
    created_at: new Date().toISOString(),
  },
  {
    id_reporte: 3, descripcion: 'Reporte ya resuelto', direccion: 'Calle 3', usuario: 'Luis',
    estado: 'RESUELTO', severidad: 'BAJA', id_usuario_asignado: 10, usuario_asignado: 'Trabajador Uno',
    created_at: new Date().toISOString(),
  },
];

function renderComo(user: typeof TRABAJADOR | typeof TITULAR) {
  const navigation = { navigate: jest.fn() } as any;
  return rtlRender(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <NavigationContainer>
        <AuthContext.Provider value={{ user } as any}>
          <ToastProvider>
            <ReportesAsignadosScreen navigation={navigation} />
          </ToastProvider>
        </AuthContext.Provider>
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

function mockApisResueltos() {
  (reportesAPI.listar as jest.Mock).mockResolvedValue({ data: REPORTES });
  (entidadesAPI.detalle as jest.Mock).mockResolvedValue({ data: { nombre_entidad: 'Acueducto Zipaquirá' } });
  (catalogosAPI.estadosReporte as jest.Mock).mockResolvedValue({
    data: [{ id_estado: 3, nombre: 'EN_PROCESO' }],
  });
}

jest.setTimeout(15000);

beforeEach(() => {
  jest.clearAllMocks();
  // Default inocuo -- el guardia (usuario sin id_entidad) nunca llama
  // mockApisResueltos(), pero useFocusEffect sigue montado (los hooks no
  // pueden ser condicionales) y de todas formas dispara
  // catalogosAPI.estadosReporte(); sin esto, el mock sin implementación
  // devuelve undefined y el .then() de la pantalla explota.
  (catalogosAPI.estadosReporte as jest.Mock).mockResolvedValue({ data: [] });
});

test('muestra el guardia cuando el usuario ENTIDAD no tiene id_entidad', async () => {
  const navigation = { navigate: jest.fn() } as any;
  rtlRender(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <NavigationContainer>
        <AuthContext.Provider value={{ user: { id_usuario: 99, id_entidad: null } } as any}>
          <ToastProvider>
            <ReportesAsignadosScreen navigation={navigation} />
          </ToastProvider>
        </AuthContext.Provider>
      </NavigationContainer>
    </SafeAreaProvider>,
  );

  expect(await screen.findByText('Tu cuenta no tiene entidad')).toBeTruthy();
  expect(reportesAPI.listar).not.toHaveBeenCalled();
});

test('carga y muestra los reportes de la entidad', async () => {
  mockApisResueltos();
  renderComo(TRABAJADOR);

  expect(await screen.findByText('Fuga asignada a mí')).toBeTruthy();
  expect(reportesAPI.listar).toHaveBeenCalled();
});

test('el trabajador normal no ve el toggle "Mis reportes"/"Equipo"', async () => {
  mockApisResueltos();
  renderComo(TRABAJADOR);
  await screen.findByText('Fuga asignada a mí');

  expect(screen.queryByText('Mis reportes')).toBeNull();
  expect(screen.queryByText(/Equipo/)).toBeNull();
});

test('el titular sí ve "Mis reportes"/"Equipo", y "Equipo" muestra todo el pool', async () => {
  mockApisResueltos();
  renderComo(TITULAR);

  // "Mis reportes" (vista por defecto) filtra a lo asignado al titular --
  // ninguno de los 3 reportes semilla está asignado a id_usuario 20, así
  // que esa vista carga vacía (no se puede esperar por un reporte que
  // nunca va a aparecer ahí).
  await screen.findByText('Nada pendiente');
  expect(screen.queryByText('Reporte del pool sin tomar')).toBeNull();

  fireEvent.press(screen.getByText('Equipo · Acueducto Zipaquirá'));

  expect(await screen.findByText('Reporte del pool sin tomar')).toBeTruthy();
  expect(screen.getByText('Fuga asignada a mí')).toBeTruthy();
});

test('el filtro "Cerrados" deja solo los reportes RESUELTO', async () => {
  mockApisResueltos();
  renderComo(TITULAR);
  await screen.findByText('Nada pendiente');
  fireEvent.press(screen.getByText('Equipo · Acueducto Zipaquirá'));
  await screen.findByText('Reporte del pool sin tomar');

  // "Cerrados" también es la etiqueta de la stat del header -- el chip de
  // filtro es la segunda aparición en el árbol (el header se pinta antes
  // que chipsRow).
  fireEvent.press(screen.getAllByText('Cerrados')[1]);

  expect(screen.getByText('Reporte ya resuelto')).toBeTruthy();
  expect(screen.queryByText('Reporte del pool sin tomar')).toBeNull();
});

test('"Tomar" marca como EN_PROCESO el reporte que el trabajador ya tiene asignado', async () => {
  // policies.py: un trabajador (no titular) solo ve/recibe del backend los
  // reportes YA asignados a él -- el pool sin tomar es exclusivo de la
  // vista del titular (ver scope_reportes()). "Tomar" para un trabajador
  // normal es autoasignarse el siguiente paso de SU propio reporte
  // (PENDIENTE/EN_REVISION -> EN_PROCESO), no reclamar uno del pool.
  mockApisResueltos();
  (reportesAPI.cambiarEstado as jest.Mock).mockResolvedValue({
    data: { reporte: { ...REPORTES[0], estado: 'EN_PROCESO' } },
  });
  renderComo(TRABAJADOR);
  await screen.findByText('Fuga asignada a mí');

  fireEvent.press(screen.getByText('Tomar'));

  await waitFor(() => {
    expect(reportesAPI.cambiarEstado).toHaveBeenCalledWith(1, {
      id_estado_nuevo: 3,
      id_usuario_asignado: 10,
    });
  });
});

test('el botón de asignar (solo del titular) abre AsignarTrabajadorModal', async () => {
  mockApisResueltos();
  renderComo(TITULAR);
  await screen.findByText('Nada pendiente');
  fireEvent.press(screen.getByText('Equipo · Acueducto Zipaquirá'));
  await screen.findByText('Reporte del pool sin tomar');

  // "Equipo" trae 2 reportes abiertos (#1 y #2), cada uno con su propio
  // botón de asignar -- mismo accessibilityLabel en los dos, así que hay
  // que desambiguar por posición en vez de getByLabelText.
  fireEvent.press(screen.getAllByLabelText('Asignar a un compañero')[0]);

  expect(await screen.findByTestId('asignar-modal')).toBeTruthy();
});
