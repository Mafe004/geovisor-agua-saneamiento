import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  TextInput, TouchableOpacity, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI, siasarAPI, usuariosAPI, entidadesAPI, auditoriaAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import type { EstadisticasResponse, ResumenMunicipio } from '../../types/domain';
import type { AdminTabParamList, RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiElevation, andiSpace, andiSeverityColor } from '../../theme/andi';

type Nav = BottomTabNavigationProp<AdminTabParamList, 'Panel'>;

// Módulos cubiertos por el enum Modulo del backend (app/core/audit.py) --
// "Actividad por módulo" usa 3 de ellos, uno por tile.
type ModuloActividad = 'REPORTES' | 'AUTH' | 'USUARIOS';

const ESTADO_ROWS: { estado: string; label: string; color: string }[] = [
  { estado: 'PENDIENTE', label: 'Pendiente', color: andiColors.warning500 },
  { estado: 'EN_REVISION', label: 'En revisión', color: andiColors.primary400 },
  { estado: 'EN_PROCESO', label: 'En proceso', color: andiColors.secondary500 },
  { estado: 'RESUELTO', label: 'Resuelto', color: andiColors.success500 },
];

type Severidad = 'BAJA' | 'MEDIA' | 'ALTA';
const SEVERIDAD_LABEL: Record<Severidad, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };

// El backend no expone un "score" por municipio -- se deriva uno localmente
// a partir de las mismas columnas que ya se muestran en la tabla (sistemas
// sin cloración / que no pasan coliformes / comunidades en estado
// deficiente), como heurística de severidad para el chip. Ajustar si SIASAR
// termina exponiendo una calificación propia.
function severidadMunicipio(f: ResumenMunicipio): Severidad {
  if (f.sistemas_no_pasa_coliformes > 0 || f.comunidades_d > 0) return 'ALTA';
  if (f.sistemas_sin_cloracion > 0) return 'MEDIA';
  return 'BAJA';
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function initials(nombre: string) {
  const parts = nombre.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días,';
  if (h < 19) return 'Buenas tardes,';
  return 'Buenas noches,';
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [resumenSiasar, setResumenSiasar] = useState<ResumenMunicipio[]>([]);
  const [usuariosCount, setUsuariosCount] = useState<number | null>(null);
  const [entidadesCount, setEntidadesCount] = useState<number | null>(null);
  const [pendientesCount, setPendientesCount] = useState<number | null>(null);
  const [actividad, setActividad] = useState<Record<ModuloActividad, number | null>>({
    REPORTES: null, AUTH: null, USUARIOS: null,
  });
  const [busquedaMunicipio, setBusquedaMunicipio] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async (silent = false) => {
    if (!silent) setLoading(true);
    // Cada estadística viene de un endpoint independiente -- allSettled para
    // que una falla no vacíe las demás (ver fix previo en este mismo
    // screen: SIASAR caído no debe ocultar el conteo de reportes).
    const [statsR, siasarR, usuariosR, entidadesR, pendientesR, repActR, authActR, usrActR] =
      await Promise.allSettled([
        reportesAPI.estadisticas(),
        siasarAPI.resumenMunicipios(),
        usuariosAPI.listar(),
        entidadesAPI.listar(),
        usuariosAPI.pendientes(),
        auditoriaAPI.listar({ modulo: 'REPORTES', limite: 1 }),
        auditoriaAPI.listar({ modulo: 'AUTH', limite: 1 }),
        auditoriaAPI.listar({ modulo: 'USUARIOS', limite: 1 }),
      ]);

    setStats(statsR.status === 'fulfilled' ? statsR.value.data : null);
    setResumenSiasar(siasarR.status === 'fulfilled' ? (siasarR.value.data || []) : []);
    setUsuariosCount(usuariosR.status === 'fulfilled' ? usuariosR.value.data.length : null);
    setEntidadesCount(entidadesR.status === 'fulfilled' ? entidadesR.value.data.length : null);
    setPendientesCount(pendientesR.status === 'fulfilled' ? pendientesR.value.data.total_pendientes : null);
    setActividad({
      REPORTES: repActR.status === 'fulfilled' ? repActR.value.data.total : null,
      AUTH: authActR.status === 'fulfilled' ? authActR.value.data.total : null,
      USUARIOS: usrActR.status === 'fulfilled' ? usrActR.value.data.total : null,
    });

    setLoading(false);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={andiColors.primary600} />
        <Text style={styles.loadingText}>Cargando estadísticas…</Text>
      </View>
    );
  }

  const totalReportes = stats?.total_reportes ?? 0;
  const estadoTotal = ESTADO_ROWS.reduce((sum, r) => {
    const found = stats?.por_estado.find(e => e.estado === r.estado);
    return sum + (found?.total ?? 0);
  }, 0);

  const filasSiasar = busquedaMunicipio.trim()
    ? resumenSiasar.filter(f => f.municipio.toLowerCase().includes(busquedaMunicipio.trim().toLowerCase()))
    : resumenSiasar;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#042F34', '#0A6F78']} style={[styles.header, { paddingTop: insets.top + andiSpace[4], height: 180 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.adminName}>{user?.nombre_completo ?? 'Administrador'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('AdminPerfil')}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user?.nombre_completo ?? 'A')}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Panel de administración</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(true); }} colors={[andiColors.primary600]} />
        }
      >
        {/* KPI tiles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiNum}>{totalReportes}</Text>
            <Text style={styles.kpiLabel}>Reportes</Text>
          </View>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiNum}>{usuariosCount ?? '—'}</Text>
            <Text style={styles.kpiLabel}>Usuarios</Text>
          </View>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiNum}>{entidadesCount ?? '—'}</Text>
            <Text style={styles.kpiLabel}>{entidadesCount === 1 ? 'Entidad' : 'Entidades'}</Text>
          </View>
        </ScrollView>

        {/* Alerta de cuentas pendientes -- solo si hay alguna */}
        {pendientesCount !== null && pendientesCount > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{pendientesCount} NUEVA{pendientesCount === 1 ? '' : 'S'}</Text>
            </View>
            <Text style={styles.alertTitle}>Cuentas pendientes de activación</Text>
            <Text style={styles.alertDesc}>Revisa y activa las cuentas que están esperando aprobación.</Text>
            <TouchableOpacity
              style={styles.alertBtn}
              onPress={() => navigation.navigate('Usuarios', { filter: 'PENDIENTE' })}
              activeOpacity={0.8}
            >
              <Text style={styles.alertBtnText}>Revisarlas</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reportes por estado */}
        <Text style={styles.sectionTitle}>Reportes por estado</Text>
        <View style={styles.estadoList}>
          {ESTADO_ROWS.map(row => {
            const count = stats?.por_estado.find(e => e.estado === row.estado)?.total ?? 0;
            const pct = estadoTotal > 0 ? (count / estadoTotal) * 100 : 0;
            return (
              <View key={row.estado} style={styles.estadoRow}>
                <View style={styles.estadoRowHeader}>
                  <Text style={styles.estadoLabel}>{row.label}</Text>
                  <Text style={styles.estadoCount}>{count}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: row.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Actividad por módulo */}
        <Text style={styles.sectionTitle}>Actividad por módulo</Text>
        <View style={styles.statTileRow}>
          <View style={styles.statTile}>
            <Feather name="file-text" size={20} color={andiColors.primary600} />
            <Text style={styles.statTileNum}>{actividad.REPORTES ?? '—'} REPORTES</Text>
          </View>
          <View style={styles.statTile}>
            <Feather name="log-in" size={20} color={andiColors.primary600} />
            <Text style={styles.statTileNum}>{actividad.AUTH ?? '—'} AUTH</Text>
          </View>
          <View style={styles.statTile}>
            <Feather name="users" size={20} color={andiColors.primary600} />
            <Text style={styles.statTileNum}>{actividad.USUARIOS ?? '—'} USUARIOS</Text>
          </View>
        </View>

        {/* SIASAR vs reportes ciudadanos */}
        <Text style={styles.sectionTitle}>SIASAR vs. reportes ciudadanos</Text>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={andiColors.onSurfaceVariant} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar municipio…"
            placeholderTextColor={andiColors.onSurfaceVariant}
            value={busquedaMunicipio}
            onChangeText={setBusquedaMunicipio}
          />
        </View>

        <FlatList
          data={filasSiasar}
          keyExtractor={f => f.municipio}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const sev = severidadMunicipio(item);
            return (
              <View style={styles.siasarRow}>
                <Text style={styles.siasarMunicipio} numberOfLines={1}>{item.municipio}</Text>
                <View style={[styles.severidadChip, { backgroundColor: andiSeverityColor[sev] + '22' }]}>
                  <View style={[styles.severidadDot, { backgroundColor: andiSeverityColor[sev] }]} />
                  <Text style={[styles.severidadChipText, { color: andiSeverityColor[sev] }]}>{SEVERIDAD_LABEL[sev]}</Text>
                </View>
                <Text style={styles.siasarFecha}>{formatFecha(item.fecha_encuesta_max)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={andiColors.onSurfaceVariant} />
              <Text style={styles.emptyStateText}>Sin datos disponibles</Text>
            </View>
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceMid },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3] },

  header: { paddingHorizontal: andiSpace[4] },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { ...andiType.bodySm, color: andiColors.primary200, minHeight: 16 },
  adminName: { ...andiType.card, color: andiColors.surface, minHeight: 22 },
  avatar: {
    width: 44, height: 44, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary400, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { ...andiType.label, color: andiColors.surface },
  headerTitle: { ...andiType.headingLg, color: andiColors.surface, marginTop: andiSpace[3] },

  scroll: { padding: andiSpace[4], paddingBottom: andiSpace[10] },

  kpiRow: { gap: andiSpace[3], paddingBottom: andiSpace[2] },
  kpiTile: {
    width: 110, backgroundColor: andiColors.surface, borderRadius: andiRadius.lg,
    ...andiElevation[1], alignItems: 'center', paddingVertical: andiSpace[4],
  },
  kpiNum: { ...andiType.displayMd, color: andiColors.primary600, fontWeight: '800' },
  kpiLabel: { ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 0.8, color: andiColors.onSurfaceVariant, marginTop: andiSpace[1] },

  alertCard: {
    backgroundColor: andiColors.surface, borderRadius: andiRadius.lg,
    borderLeftWidth: 4, borderLeftColor: andiColors.warning500,
    padding: andiSpace[4], marginTop: andiSpace[4],
  },
  alertBadge: { alignSelf: 'flex-start', backgroundColor: andiColors.warning100, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[3], paddingVertical: 2 },
  alertBadgeText: { ...andiType.labelSm, color: andiColors.warning700 },
  alertTitle: { ...andiType.labelMd, fontWeight: '700', color: andiColors.onSurface, marginTop: andiSpace[2] },
  alertDesc: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[1] },
  alertBtn: {
    alignSelf: 'flex-start', marginTop: andiSpace[3], borderWidth: 1.5, borderColor: andiColors.primary600,
    borderRadius: andiRadius.full, paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[1],
  },
  alertBtnText: { ...andiType.labelSm, color: andiColors.primary600 },

  sectionTitle: {
    ...andiType.labelMd, textTransform: 'uppercase', letterSpacing: 0.8,
    color: andiColors.onSurfaceVariant, marginTop: andiSpace[6], marginBottom: andiSpace[2],
  },

  estadoList: { gap: andiSpace[3] },
  estadoRow: {},
  estadoRowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  estadoLabel: { ...andiType.bodySm, color: andiColors.onSurface },
  estadoCount: { ...andiType.labelSm, color: andiColors.onSurfaceVariant },
  progressTrack: { height: 6, borderRadius: andiRadius.xs, backgroundColor: andiColors.outlineVariant, marginTop: andiSpace[1], overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: andiRadius.xs },

  statTileRow: { flexDirection: 'row', gap: andiSpace[3] },
  statTile: {
    flex: 1, backgroundColor: andiColors.surface, borderRadius: andiRadius.lg,
    ...andiElevation[1], alignItems: 'center', paddingVertical: andiSpace[4], gap: andiSpace[2],
  },
  statTileNum: { ...andiType.labelSm, textTransform: 'uppercase', letterSpacing: 0.6, color: andiColors.onSurfaceVariant, textAlign: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[2],
    borderWidth: 1.5, borderColor: andiColors.outline, borderRadius: andiRadius.md,
    backgroundColor: andiColors.surface, paddingHorizontal: andiSpace[3], minHeight: 40,
  },
  searchInput: { flex: 1, minHeight: 40, fontSize: 13, color: andiColors.onSurface },

  siasarRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: andiColors.surface,
    borderRadius: andiRadius.md, padding: andiSpace[3], marginTop: andiSpace[2], gap: andiSpace[2],
  },
  siasarMunicipio: { ...andiType.bodySm, color: andiColors.onSurface, flex: 1 },
  severidadChip: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[1], borderRadius: andiRadius.full, paddingHorizontal: andiSpace[2], paddingVertical: 2 },
  severidadDot: { width: 6, height: 6, borderRadius: andiRadius.full },
  severidadChipText: { ...andiType.caption, fontWeight: '700' },
  siasarFecha: { ...andiType.caption, color: andiColors.onSurfaceVariant, width: 72, textAlign: 'right' },

  emptyState: { alignItems: 'center', paddingVertical: andiSpace[8] },
  emptyStateText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3] },
});
