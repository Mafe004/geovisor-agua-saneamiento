import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/services';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.log('Error cargando auth:', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (correo, password) => {
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

  const updateUser = (userData) => {
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
