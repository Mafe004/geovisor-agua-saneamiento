import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

// Auth
import LoginScreen    from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Perfil compartido (todos los roles)
import PerfilScreen from '../screens/shared/PerfilScreen';

// Ciudadano
import MapaScreen          from '../screens/ciudadano/MapaScreen';
import MisReportesScreen   from '../screens/ciudadano/MisReportesScreen';
import CrearReporteScreen  from '../screens/ciudadano/CrearReporteScreen';
import NotificacionesScreen from '../screens/ciudadano/NotificacionesScreen';

// Entidad
import ReportesAsignadosScreen from '../screens/entidad/ReportesAsignadosScreen';
import DetalleReporteScreen    from '../screens/entidad/DetalleReporteScreen';

// Moderador
import TodosReportesScreen from '../screens/moderador/TodosReportesScreen';
import HistorialScreen     from '../screens/moderador/HistorialScreen';

// Admin
import DashboardScreen  from '../screens/admin/DashboardScreen';
import UsuariosScreen   from '../screens/admin/UsuariosScreen';
import EntidadesScreen  from '../screens/admin/EntidadesScreen';
import AuditoriaScreen  from '../screens/admin/AuditoriaScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Configuración de tabs por rol ─────────────────────────────
const TAB_CONFIG = {
  Mapa:          { icon: '🗺️',  label: 'Mapa'       },
  Reportes:      { icon: '📋',  label: 'Reportes'   },
  Crear:         { icon: '➕',  label: 'Crear'      },
  Notificaciones:{ icon: '🔔',  label: 'Avisos'     },
  Perfil:        { icon: '👤',  label: 'Perfil'     },
  Dashboard:     { icon: '📊',  label: 'Dashboard'  },
  Usuarios:      { icon: '👥',  label: 'Usuarios'   },
  Entidades:     { icon: '🏢',  label: 'Entidades'  },
  Auditoría:     { icon: '🔍',  label: 'Auditoría'  },
  Asignados:     { icon: '📌',  label: 'Asignados'  },
  Historial:     { icon: '📜',  label: 'Historial'  },
};

// ── Tab bar icon personalizado ────────────────────────────────
function TabIcon({ name, focused, color }) {
  const cfg = TAB_CONFIG[name] || { icon: '•' };
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Text style={tabStyles.iconText}>{cfg.icon}</Text>
    </View>
  );
}

// ── Opciones compartidas del tab navigator ────────────────────
const sharedTabOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor:   '#1565C0',
  tabBarInactiveTintColor: '#9CA3AF',
  tabBarStyle: tabStyles.bar,
  tabBarLabelStyle: tabStyles.label,
  tabBarLabel: TAB_CONFIG[route.name]?.label || route.name,
  tabBarIcon: ({ focused, color }) => (
    <TabIcon name={route.name} focused={focused} color={color} />
  ),
});

// ── TAB NAVIGATORS ────────────────────────────────────────────

function CiudadanoTabs() {
  return (
    <Tab.Navigator screenOptions={sharedTabOptions}>
      <Tab.Screen name="Mapa"           component={MapaScreen} />
      <Tab.Screen name="Reportes"       component={MisReportesScreen} />
      <Tab.Screen name="Crear"          component={CrearReporteScreen} />
      <Tab.Screen name="Notificaciones" component={NotificacionesScreen} />
      <Tab.Screen name="Perfil"         component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function EntidadTabs() {
  return (
    <Tab.Navigator screenOptions={sharedTabOptions}>
      <Tab.Screen name="Asignados" component={ReportesAsignadosScreen} />
      <Tab.Screen name="Perfil"    component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function ModeradorTabs() {
  return (
    <Tab.Navigator screenOptions={sharedTabOptions}>
      <Tab.Screen name="Reportes"  component={TodosReportesScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Perfil"    component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={sharedTabOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Reportes"  component={TodosReportesScreen} />
      <Tab.Screen name="Usuarios"  component={UsuariosScreen} />
      <Tab.Screen name="Entidades" component={EntidadesScreen} />
      <Tab.Screen name="Perfil"    component={PerfilScreen} />
    </Tab.Navigator>
  );
}

// ── ROOT NAVIGATOR ────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <LoadingScreen message="Iniciando GeoVisor…" />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : user.id_rol === 4 ? (
          <>
            <Stack.Screen name="AdminHome"      component={AdminTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        ) : user.id_rol === 3 ? (
          <>
            <Stack.Screen name="ModeradorHome"  component={ModeradorTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        ) : user.id_rol === 2 ? (
          <>
            <Stack.Screen name="EntidadHome"    component={EntidadTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="CiudadanoHome"  component={CiudadanoTabs} />
            <Stack.Screen name="DetalleReporte" component={DetalleReporteScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Estilos del tab bar ───────────────────────────────────────
const tabStyles = StyleSheet.create({
  bar: {
    height: 68,
    paddingBottom: 10,
    paddingTop: 6,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
    elevation: 12,
    shadowColor: '#1565C0',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 0,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#EFF6FF',
  },
  iconText: { fontSize: 19 },
});
