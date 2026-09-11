import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/services';
import { registerSessionExpiredHandler } from '../api/client';
import type { AuthContextValue } from '../types/models';
import type { UserPublic } from '../types/domain';

// Nunca se lee antes de que AuthProvider monte (App.js siempre envuelve todo
// en AuthProvider), así que este valor por defecto nunca se usa de verdad —
// existe solo para que createContext no exija `| undefined` en todo
// consumidor de useAuth().
export const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cualquier 401 en cualquier request (no solo el chequeo de arranque)
    // pasa por acá — sin esto, la UI se queda en una pantalla logueada con
    // un token que el backend ya rechazó.
    registerSessionExpiredHandler(logout);
    loadStoredAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');

      if (!storedToken || !storedUser) {
        return; // no hay sesión guardada, nada que revalidar
      }

      try {
        // El servidor es la fuente de verdad, no lo que quedó cacheado:
        // si mientras tanto cambiaron el rol o suspendieron la cuenta,
        // esto lo refleja apenas se abre la app.
        const res = await authAPI.me();
        const freshUser = res.data;
        await AsyncStorage.setItem('user', JSON.stringify(freshUser));
        setToken(storedToken);
        setUser(freshUser);
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 401 || status === 403) {
          // El token ya no es válido de verdad (vencido, rechazado, cuenta
          // suspendida) — cerrar sesión y mandar a login.
          await logout();
        } else {
          // Sin error.response: no hubo respuesta del servidor (backend
          // caído, sin red, timeout). No se sabe si la sesión sigue siendo
          // válida, así que NO se borra — usar lo cacheado para que la app
          // abra igual con WiFi inestable. Vaciar una sesión válida porque
          // se cayó el WiFi es peor que el bug que esto arregla.
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      }
    } catch (e) {
      console.log('Error cargando auth:', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (correo: string, password: string) => {
    const res = await authAPI.login(correo, password);
    const { access_token, user: userData } = res.data;
    await AsyncStorage.setItem('token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData: UserPublic) => {
    setUser(userData);
    AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  // Roles: 1=CIUDADANO, 2=ENTIDAD, 3=MODERADOR, 4=ADMIN
  const isAdmin = user?.id_rol === 4;
  const isModerador = user?.id_rol === 3;
  const isEntidad = user?.id_rol === 2;
  const isCiudadano = user?.id_rol === 1;

  return (
    <AuthContext.Provider
      value={{
        user, token, loading,
        login, logout, updateUser,
        isAdmin, isModerador, isEntidad, isCiudadano,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
