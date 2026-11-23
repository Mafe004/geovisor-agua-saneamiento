/**
 * Pruebas de RegisterScreen: sus 4 flujos (Ciudadano, Entidad, Moderador,
 * Administrador) -- validación de campos, envío, y a dónde navega cada
 * uno al terminar. Componente puro de UI (sin useFocusEffect ni
 * useSafeAreaInsets), así que se renderiza sin providers extra.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import RegisterScreen from '../screens/auth/RegisterScreen';
import { usuariosAPI } from '../api/services';
import { Rol } from '../types/models';

jest.mock('../api/services', () => ({
  usuariosAPI: { register: jest.fn(), registrarConInvitacion: jest.fn() },
}));

function renderComo(id_rol: number, codigoData?: { codigo: string }) {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;
  const route = { params: { id_rol, codigoData } } as any;
  render(<RegisterScreen navigation={navigation} route={route} />);
  return navigation;
}

jest.setTimeout(15000);

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Flujo Ciudadano ──────────────────────────────────────────────────────

describe('Flujo Ciudadano', () => {
  test('exige nombre, correo y contraseña antes de enviar', () => {
    renderComo(Rol.CIUDADANO);

    fireEvent.press(screen.getByText('Crear cuenta'));

    expect(screen.getByText('Nombre completo, correo y contraseña son obligatorios.')).toBeTruthy();
    expect(usuariosAPI.register).not.toHaveBeenCalled();
  });

  test('exige un correo con formato válido', () => {
    renderComo(Rol.CIUDADANO);

    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Ana Gómez');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'no-es-un-correo');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'claveSegura');
    fireEvent.press(screen.getByText('Crear cuenta'));

    expect(screen.getByText('Ingresa un correo válido.')).toBeTruthy();
    expect(usuariosAPI.register).not.toHaveBeenCalled();
  });

  test('exige al menos 6 caracteres de contraseña', () => {
    renderComo(Rol.CIUDADANO);

    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Ana Gómez');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@correo.com');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), '123');
    fireEvent.press(screen.getByText('Crear cuenta'));

    expect(screen.getByText('La contraseña debe tener al menos 6 caracteres.')).toBeTruthy();
    expect(usuariosAPI.register).not.toHaveBeenCalled();
  });

  test('envía el correo recortado y en minúsculas, y navega a TelefonoOpcional', async () => {
    (usuariosAPI.register as jest.Mock).mockResolvedValue({ data: { id_usuario: 42 } });
    const navigation = renderComo(Rol.CIUDADANO);

    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Ana Gómez');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), '  Ana@Correo.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'claveSegura');
    fireEvent.press(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(usuariosAPI.register).toHaveBeenCalledWith({
        nombre_completo: 'Ana Gómez', correo: 'ana@correo.com', password: 'claveSegura',
      });
    });
    expect(navigation.navigate).toHaveBeenCalledWith('TelefonoOpcional', { userId: 42 });
  });

  test('correo duplicado muestra el aviso con accesos a Entrar / Olvidé la clave', async () => {
    (usuariosAPI.register as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { detail: 'El correo ya está registrado' } },
    });
    renderComo(Rol.CIUDADANO);

    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Ana Gómez');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@correo.com');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'claveSegura');
    fireEvent.press(screen.getByText('Crear cuenta'));

    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.getByText('Olvidé la clave')).toBeTruthy();
  });
});

// ── Flujo Entidad (stepper de 3 pasos) ──────────────────────────────────

describe('Flujo Entidad', () => {
  test('el paso 2 no deja avanzar hasta llenar nombre/cargo/teléfono y una contraseña de 10+', () => {
    renderComo(Rol.ENTIDAD, { codigo: 'ABC123' });
    fireEvent.press(screen.getByText('Siguiente'));

    expect(screen.getByText('Nombre completo')).toBeTruthy();
    const siguientePaso2 = screen.getByText('Siguiente');
    fireEvent.press(siguientePaso2);
    // Sigue en el paso 2 -- "Cargo en la entidad" solo existe ahí.
    expect(screen.getByText('Cargo en la entidad')).toBeTruthy();
  });

  test('canjea el código de invitación y navega a Login con el mensaje de Entidad', async () => {
    (usuariosAPI.registrarConInvitacion as jest.Mock).mockResolvedValue({ data: { id_usuario: 7, id_rol: 2 } });
    const navigation = renderComo(Rol.ENTIDAD, { codigo: 'ABC123' });

    fireEvent.press(screen.getByText('Siguiente')); // paso 1 -> 2
    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Carlos Ruiz');
    fireEvent.changeText(screen.getByPlaceholderText('Coordinador operativo'), 'Operador');
    fireEvent.changeText(screen.getByPlaceholderText('+57 300 0000000'), '3001234567');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 10 caracteres'), 'claveDeDiezCaracteres');
    fireEvent.press(screen.getByText('Siguiente')); // paso 2 -> 3

    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'carlos@entidad.com');
    fireEvent.press(screen.getByText('Crear cuenta como Entidad'));

    await waitFor(() => {
      expect(usuariosAPI.registrarConInvitacion).toHaveBeenCalledWith({
        token: 'ABC123', nombre_completo: 'Carlos Ruiz', cargo: 'Operador',
        correo: 'carlos@entidad.com', password: 'claveDeDiezCaracteres', telefono: '3001234567',
      });
    });
    expect(navigation.navigate).toHaveBeenCalledWith('Login', {
      successMessage: 'Cuenta de Entidad creada. Ya puedes iniciar sesión.',
    });
  });

  test('sin código de invitación, muestra el error al enviar', () => {
    renderComo(Rol.ENTIDAD, undefined);
    fireEvent.press(screen.getByText('Siguiente'));
    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Carlos Ruiz');
    fireEvent.changeText(screen.getByPlaceholderText('Coordinador operativo'), 'Operador');
    fireEvent.changeText(screen.getByPlaceholderText('+57 300 0000000'), '3001234567');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 10 caracteres'), 'claveDeDiezCaracteres');
    fireEvent.press(screen.getByText('Siguiente'));
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'carlos@entidad.com');
    fireEvent.press(screen.getByText('Crear cuenta como Entidad'));

    expect(screen.getByText(/Falta el código de invitación/)).toBeTruthy();
    expect(usuariosAPI.registrarConInvitacion).not.toHaveBeenCalled();
  });
});

// ── Flujo Moderador ──────────────────────────────────────────────────────

describe('Flujo Moderador', () => {
  test('el botón de envío queda deshabilitado hasta aceptar el acuerdo de conducta', () => {
    renderComo(Rol.MODERADOR, { codigo: 'XYZ789' });

    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Laura Pérez');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'laura@correo.com');
    fireEvent.changeText(screen.getByPlaceholderText('+57 300 0000000'), '3001234567');
    fireEvent.changeText(screen.getByPlaceholderText('Número de documento'), '1234567890');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 10 caracteres'), 'claveDeDiezCaracteres');

    fireEvent.press(screen.getByText('Aceptar y entrar'));
    expect(usuariosAPI.registrarConInvitacion).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Acepto el acuerdo de conducta'));
    fireEvent.press(screen.getByText('Aceptar y entrar'));
    expect(usuariosAPI.registrarConInvitacion).toHaveBeenCalled();
  });

  test('canjea el código y navega a Login con el mensaje de Moderador', async () => {
    (usuariosAPI.registrarConInvitacion as jest.Mock).mockResolvedValue({ data: { id_usuario: 8, id_rol: 3 } });
    const navigation = renderComo(Rol.MODERADOR, { codigo: 'XYZ789' });

    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Laura Pérez');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'laura@correo.com');
    fireEvent.changeText(screen.getByPlaceholderText('+57 300 0000000'), '3001234567');
    fireEvent.changeText(screen.getByPlaceholderText('Número de documento'), '1234567890');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 10 caracteres'), 'claveDeDiezCaracteres');
    fireEvent.press(screen.getByText('Acepto el acuerdo de conducta'));
    fireEvent.press(screen.getByText('Aceptar y entrar'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('Login', {
        successMessage: 'Cuenta de Moderador creada. Ya puedes iniciar sesión.',
      });
    });
  });
});

// ── Flujo Administrador ──────────────────────────────────────────────────

describe('Flujo Administrador', () => {
  function llenarFormulario() {
    fireEvent.changeText(screen.getByPlaceholderText('María García'), 'Diego Soto');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'diego@correo.com');
    fireEvent.changeText(screen.getByPlaceholderText('+57 300 0000000'), '3001234567');
    fireEvent.changeText(screen.getByPlaceholderText('Número de documento'), '1234567890');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 10 caracteres'), 'claveDeDiezCaracteres');
    fireEvent.press(screen.getByText('Acepto el acuerdo de conducta'));
  }

  test('con código de invitación, canjea y navega a Login', async () => {
    (usuariosAPI.registrarConInvitacion as jest.Mock).mockResolvedValue({ data: { id_usuario: 9, id_rol: 4 } });
    const navigation = renderComo(Rol.ADMINISTRADOR, { codigo: 'ADM999' });

    llenarFormulario();
    fireEvent.press(screen.getByText('Crear cuenta'));

    await waitFor(() => {
      expect(usuariosAPI.registrarConInvitacion).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'ADM999', correo: 'diego@correo.com', tipo_documento: 'CC' }),
      );
    });
    expect(navigation.navigate).toHaveBeenCalledWith('Login', {
      successMessage: 'Cuenta de Administrador creada. Ya puedes iniciar sesión.',
    });
  });

  test('sin código, simula una solicitud de acceso pendiente de aprobación', async () => {
    renderComo(Rol.ADMINISTRADOR, undefined);

    llenarFormulario();
    fireEvent.press(screen.getByText('Solicitar acceso'));

    expect(await screen.findByText('Solicitud enviada')).toBeTruthy();
    expect(usuariosAPI.registrarConInvitacion).not.toHaveBeenCalled();
  });
});
