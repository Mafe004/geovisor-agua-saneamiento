import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import { AuthContext } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import type { RootStackParamList } from './types';
import { andiColors, andiRadius, andiElevation } from '../theme/andi';

// Auth
import LoginScreen    from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Perfil compartido (Moderador/Entidad/Admin)
import PerfilScreen from '../screens/shared/PerfilScreen';

// Ciudadano
import MapaScreen                    from '../screens/ciudadano/MapaScreen';
import MisReportesScreen             from '../screens/ciudadano/MisReportesScreen';
import CrearReporteScreen            from '../screens/ciudadano/CrearReporteScreen';
import NotificacionesScreen          from '../screens/ciudadano/NotificacionesScreen';
import CiudadanoPerfilScreen         from '../screens/ciudadano/PerfilScreen';
import CiudadanoDetalleReporteScreen from '../screens/ciudadano/DetalleReporteScreen';

// Entidad
import ReportesAsignadosScreen   from '../screens/entidad/ReportesAsignadosScreen';
import DetalleReporteScreen      from '../screens/entidad/DetalleReporteScreen';
import EntidadCrearReporteScreen from '../screens/entidad/CrearReporteScreen';
import CifrasEntidadScreen       from '../screens/entidad/CifrasEntidadScreen';
import MapaEntidadScreen         from '../screens/entidad/MapaEntidadScreen';

// Moderador
import TodosReportesScreen     from '../screens/moderador/TodosReportesScreen';
import HistorialScreen         from '../screens/moderador/HistorialScreen';
import TriageScreen            from '../screens/moderador/TriageScreen';
import InfraestructuraScreen   from '../screens/moderador/InfraestructuraScreen';

// Admin
import DashboardScreen  from '../screens/admin/DashboardScreen';
import UsuariosScreen   from '../screens/admin/UsuariosScreen';
import EntidadesScreen  from '../screens/admin/EntidadesScreen';
import AuditoriaScreen  from '../screens/admin/AuditoriaScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator();

// ── Configuración de tabs por rol ─────────────────────────────
const TAB_CONFIG: Record<string, { icon: string; label: string }> = {
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
  Triage:        { icon: '🩺',  label: 'Triage'     },
  Infra:         { icon: '🏗️',  label: 'Infra'      },
  Cifras:        { icon: '📊',  label: 'Cifras'     },
};

// ── Tab bar icon personalizado ────────────────────────────────
function TabIcon({ name, focused }: { name: string; focused: boolean; color: string }) {
  const cfg = TAB_CONFIG[name] || { icon: '•' };
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Text style={tabStyles.iconText}>{cfg.icon}</Text>
    </View>
  );
}

// ── Tabs de Moderador/Entidad (sistema visual Andi) ────────────
// Ícono Feather + si es el tab de "Crear" (solo Entidad), un FAB elevado
// en vez de un ícono normal -- así lo dibuja el canvas.
const ANDI_TAB_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  Triage: 'inbox',
  Historial: 'clock',
  Infra: 'map',
  Perfil: 'user',
  Asignados: 'inbox',
  Cifras: 'pie-chart',
  Mapa: 'map',
};

function AndiTabIcon({ name, focused }: { name: string; focused: boolean }) {
  if (name === 'Crear') {
    return (
      <View style={[andiTabStyles.fab, andiElevation[3]]}>
        <Feather name="plus" size={30} color={andiColors.n0} />
      </View>
    );
  }
  const icon = ANDI_TAB_ICON[name] ?? 'circle';
  return <Feather name={icon} size={20} color={focused ? andiColors.primary : andiColors.onSurfaceVariant} />;
}

function makeAndiTabOptions(barHeight: number) {
  return ({ route }: { route: RouteProp<ParamListBase> }): BottomTabNavigationOptions => {
    const isFab = route.name === 'Crear';
    return {
      headerShown: false,
      tabBarActiveTintColor: andiColors.primary,
      tabBarInactiveTintColor: andiColors.onSurfaceVariant,
      tabBarStyle: [andiTabStyles.bar, { height: barHeight }],
      tabBarLabelStyle: andiTabStyles.label,
      tabBarLabel: isFab ? () => null : (TAB_CONFIG[route.name]?.label || route.name),
      tabBarIcon: ({ focused }) => <AndiTabIcon name={route.name} focused={focused} />,
    };
  };
}
// Moderador: 4 tabs, sin FAB (88px en el canvas). Entidad: 5 tabs con FAB
// central elevado, que necesita más espacio libre arriba (96px).
const andiTabOptionsModerador = makeAndiTabOptions(88);
const andiTabOptionsEntidad = makeAndiTabOptions(96);

// ── Opciones compartidas del tab navigator ────────────────────
const sharedTabOptions = ({
  route,
}: {
  route: RouteProp<ParamListBase>;
}): BottomTabNavigationOptions => ({
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

// ── Tab bar de Ciudadano (tema "Andi", FAB terracota) ──────────
// Nombres con prefijo "Ciudadano" a propósito: Moderador/Entidad ya tienen
// su propio AndiTabIcon/andiTabStyles arriba (ícono Feather, FAB celeste) --
// esto evita chocar con esos nombres y mezclar los dos sistemas de tabs Andi.
const CIUDADANO_ANDI_TAB_CONFIG: Record<string, { icon: string; label: string }> = {
  Mapa:           { icon: '◈', label: 'Mapa' },
  Reportes:       { icon: '▤', label: 'Reportes' },
  Crear:          { icon: '+', label: '' },
  Notificaciones: { icon: '◔', label: 'Avisos' },
  Perfil:         { icon: '◍', label: 'Perfil' },
};

function CiudadanoAndiTabIcon({ name, focused }: { name: string; focused: boolean }) {
  const cfg = CIUDADANO_ANDI_TAB_CONFIG[name] || { icon: '•' };
  if (name === 'Crear') {
    return (
      <View style={ciudadanoAndiTabStyles.fab}>
        <Text style={ciudadanoAndiTabStyles.fabIcon}>{cfg.icon}</Text>
      </View>
    );
  }
  return (
    <View style={ciudadanoAndiTabStyles.iconWrap}>
      <Text style={[ciudadanoAndiTabStyles.iconText, focused && ciudadanoAndiTabStyles.iconTextActive]}>{cfg.icon}</Text>
    </View>
  );
}

const ciudadanoTabOptions = ({
  route,
}: {
  route: RouteProp<ParamListBase>;
}): BottomTabNavigationOptions => ({
  headerShown: false,
  tabBarActiveTintColor:   andiColors.primary600,
  tabBarInactiveTintColor: andiColors.n400,
  tabBarStyle: ciudadanoAndiTabStyles.bar,
  tabBarLabelStyle: ciudadanoAndiTabStyles.label,
  tabBarLabel: CIUDADANO_ANDI_TAB_CONFIG[route.name]?.label ?? route.name,
  tabBarIcon: ({ focused }) => <CiudadanoAndiTabIcon name={route.name} focused={focused} />,
});

// ── TAB NAVIGATORS ────────────────────────────────────────────

function CiudadanoTabs() {
  return (
    <Tab.Navigator screenOptions={ciudadanoTabOptions}>
      <Tab.Screen name="Mapa"           component={MapaScreen} />
      <Tab.Screen name="Reportes"       component={MisReportesScreen} />
      <Tab.Screen name="Crear"          component={CrearReporteScreen} />
      <Tab.Screen name="Notificaciones" component={NotificacionesScreen} />
      <Tab.Screen name="Perfil"         component={CiudadanoPerfilScreen} />
    </Tab.Navigator>
  );
}

function EntidadTabs() {
  return (
    <Tab.Navigator screenOptions={andiTabOptionsEntidad}>
      <Tab.Screen name="Asignados" component={ReportesAsignadosScreen} />
      <Tab.Screen name="Cifras"    component={CifrasEntidadScreen} />
      <Tab.Screen name="Crear"     component={EntidadCrearReporteScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Mapa"      component={MapaEntidadScreen} />
      <Tab.Screen name="Perfil"    component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function ModeradorTabs() {
  return (
    <Tab.Navigator screenOptions={andiTabOptionsModerador}>
      <Tab.Screen name="Triage"    component={TriageScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Infra"     component={InfraestructuraScreen} />
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
      <Tab.Screen name="Auditoría" component={AuditoriaScreen} />
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
            <Stack.Screen name="DetalleReporte" component={CiudadanoDetalleReporteScreen} />
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

// ── Estilos del tab bar Andi (Moderador/Entidad) ───────────────
const andiTabStyles = StyleSheet.create({
  bar: {
    paddingTop: 10,
    backgroundColor: andiColors.surface,
    borderTopWidth: 1,
    borderTopColor: andiColors.outlineVariant,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  fab: {
    width: 60, height: 60, borderRadius: andiRadius.xl,
    backgroundColor: andiColors.accent500,
    marginTop: -28,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── Estilos del tab bar Andi de Ciudadano ───────────────────────
const ciudadanoAndiTabStyles = StyleSheet.create({
  bar: {
    height: 68,
    paddingBottom: 10,
    paddingTop: 6,
    backgroundColor: andiColors.surface,
    borderTopWidth: 1,
    borderTopColor: andiColors.outlineVariant,
    elevation: 12,
    shadowColor: andiColors.primary900,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 0,
  },
  iconWrap: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  iconText: { fontSize: 19, color: andiColors.n400 },
  iconTextActive: { color: andiColors.primary600 },
  fab: {
    width: 52, height: 52, borderRadius: 20,
    backgroundColor: andiColors.accent500,
    marginTop: -24,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: andiColors.primary900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
});
