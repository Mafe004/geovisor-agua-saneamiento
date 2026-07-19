import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Ciudadano
import MapaScreen from '../screens/ciudadano/MapaScreen';
import MisReportesScreen from '../screens/ciudadano/MisReportesScreen';
import CrearReporteScreen from '../screens/ciudadano/CrearReporteScreen';
import NotificacionesScreen from '../screens/ciudadano/NotificacionesScreen';
import PerfilScreen from '../screens/ciudadano/PerfilScreen';

// Entidad
import ReportesAsignadosScreen from '../screens/entidad/ReportesAsignadosScreen';
import DetalleReporteScreen from '../screens/entidad/DetalleReporteScreen';

// Moderador
import TodosReportesScreen from '../screens/moderador/TodosReportesScreen';
import HistorialScreen from '../screens/moderador/HistorialScreen';

// Admin
import DashboardScreen from '../screens/admin/DashboardScreen';
import UsuariosScreen from '../screens/admin/UsuariosScreen';
import EntidadesScreen from '../screens/admin/EntidadesScreen';
import AuditoriaScreen from '../screens/admin/AuditoriaScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICON = {
  Mapa: '🗺️',
  Reportes: '📋',
  Crear: '➕',
  Notificaciones: '🔔',
  Perfil: '👤',
  Dashboard: '📊',
  Usuarios: '👥',
  Entidades: '🏢',
  Auditoría: '🔍',
  Asignados: '📌',
  Historial: '📜',
};

// ── TAB NAVIGATORS ──────────────────────────────────────────
function CiudadanoTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name] || '•'}</Text>
        ),
      })}
    >
      <Tab.Screen name="Mapa" component={MapaScreen} />
      <Tab.Screen name="Reportes" component={MisReportesScreen} />
      <Tab.Screen name="Crear" component={CrearReporteScreen} />
      <Tab.Screen name="Notificaciones" component={NotificacionesScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function EntidadTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name] || '•'}</Text>
        ),
      })}
    >
      <Tab.Screen name="Asignados" component={ReportesAsignadosScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function ModeradorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name] || '•'}</Text>
        ),
      })}
    >
      <Tab.Screen name="Reportes" component={TodosReportesScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name] || '•'}</Text>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Reportes" component={TodosReportesScreen} />
      <Tab.Screen name="Usuarios" component={UsuariosScreen} />
      <Tab.Screen name="Entidades" component={EntidadesScreen} />
      <Tab.Screen name="Auditoría" component={AuditoriaScreen} />
    </Tab.Navigator>
  );
}

// ── ROOT NAVIGATOR ────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <LoadingScreen message="Iniciando sesión..." />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Pantallas públicas
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : user.id_rol === 4 ? (
          <>
            <Stack.Screen name="AdminHome" component={AdminTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        ) : user.id_rol === 3 ? (
          <>
            <Stack.Screen name="ModeradorHome" component={ModeradorTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        ) : user.id_rol === 2 ? (
          <>
            <Stack.Screen name="EntidadHome" component={EntidadTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        ) : (
          // Ciudadano (rol 1) por defecto
          <>
            <Stack.Screen name="CiudadanoHome" component={CiudadanoTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
