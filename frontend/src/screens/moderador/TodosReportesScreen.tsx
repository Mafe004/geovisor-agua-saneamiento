import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { reportesAPI, catalogosAPI } from '../../api/services';
import AndiHeader, { AndiHeaderIconButton } from '../../components/andi/AndiHeader';
import AndiBody from '../../components/andi/AndiBody';
import AndiChip from '../../components/andi/AndiChip';
import AndiReportCard from '../../components/andi/AndiReportCard';
import AndiStatusBadge from '../../components/andi/AndiStatusBadge';
import AndiEmptyState from '../../components/andi/AndiEmptyState';
import { AndiSkeletonList } from '../../components/andi/AndiSkeletonCard';
import type { Reporte, EstadoReporteItem } from '../../types/domain';
import type { operations } from '../../types/api';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

type ReportesQuery = operations['listar_reportes_reportes__get']['parameters']['query'];

function formatRelative(dateStr: string | undefined) {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function TodosReportesScreen({ navigation }: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estadosDisponibles, setEstadosDisponibles] = useState<EstadoReporteItem[]>([]);
  const [idEstado, setIdEstado] = useState<number | null>(null);
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let mounted = true;
    catalogosAPI.estadosReporte()
      .then(res => { if (mounted) setEstadosDisponibles(res.data || []); })
      .catch(() => { if (mounted) setEstadosDisponibles([]); });
    return () => { mounted = false; };
  }, []);

  const loadReportes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: ReportesQuery = {};
      if (idEstado != null) params.id_estado = idEstado;
      const res = await reportesAPI.listar(params);
      setReportes(res.data || []);
    } catch (_) {
      setReportes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idEstado]);

  useFocusEffect(useCallback(() => { loadReportes(); }, [loadReportes]));

  const reportesFiltrados = busqueda.trim()
    ? reportes.filter(item =>
        item.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
        String(item.id_reporte).includes(busqueda)
      )
    : reportes;

  return (
    <View style={styles.container}>
      <AndiHeader
        overline="Zipaquirá, Cundinamarca"
        title="Todos los reportes"
        stats={[{ value: reportesFiltrados.length, label: 'Resultados' }]}
        rightElement={
          <AndiHeaderIconButton
            icon={busquedaVisible ? 'x' : 'search'}
            onPress={() => {
              setBusquedaVisible(v => !v);
              if (busquedaVisible) setBusqueda('');
            }}
            accessibilityLabel={busquedaVisible ? 'Cerrar búsqueda' : 'Buscar'}
          />
        }
      />

      <AndiBody>
        {busquedaVisible && (
          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={andiColors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por ID o descripción…"
              placeholderTextColor={andiColors.onSurfaceVariant}
              value={busqueda}
              onChangeText={setBusqueda}
              autoFocus
            />
          </View>
        )}

        <View style={styles.chipsRow}>
          <AndiChip label="Todos" variant={idEstado === null ? 'solid' : 'outline'} onPress={() => setIdEstado(null)} />
          {estadosDisponibles.map(e => (
            <AndiChip
              key={e.id_estado}
              label={e.nombre.replace(/_/g, ' ')}
              variant={idEstado === e.id_estado ? 'solid' : 'outline'}
              onPress={() => setIdEstado(e.id_estado)}
            />
          ))}
        </View>

        {loading ? (
          <View style={styles.list}><AndiSkeletonList count={5} /></View>
        ) : reportesFiltrados.length === 0 ? (
          <AndiEmptyState
            icon={busqueda.trim() ? 'search' : 'inbox'}
            title="Sin resultados"
            body={busqueda.trim() ? `Nada coincide con "${busqueda.trim()}".` : 'No hay reportes con el filtro seleccionado.'}
            ctaLabel={busqueda.trim() ? 'Borrar búsqueda' : 'Ver todos'}
            onPressCta={() => { setBusqueda(''); setIdEstado(null); }}
          />
        ) : (
          <FlatList
            data={reportesFiltrados}
            keyExtractor={item => String(item.id_reporte)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadReportes(true); }}
                colors={[andiColors.primary600]}
              />
            }
            renderItem={({ item }) => (
              <AndiReportCard
                idLabel={`#${item.id_reporte} · ${formatRelative(item.created_at)}`}
                badge={<AndiStatusBadge status={item.estado} />}
                title={item.descripcion || 'Sin descripción'}
                meta={`${item.direccion || '—'} · ${item.usuario || '—'}`}
                severidad={item.severidad}
                onPress={() => navigation.navigate('DetalleReporte', { reporte: item })}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: andiSpace[2] }} />}
          />
        )}
      </AndiBody>
    </View>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[2],
    marginHorizontal: andiSpace[5], marginTop: andiSpace[4],
    backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg,
    paddingHorizontal: andiSpace[3], height: 44,
    maxWidth: r.maxContentWidth(700), alignSelf: 'center', width: '100%',
  },
  searchInput: { flex: 1, fontSize: 16, color: andiColors.onSurface, height: '100%' },
  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[2],
    paddingHorizontal: andiSpace[5], paddingTop: andiSpace[4], paddingBottom: andiSpace[3],
    width: '100%', maxWidth: r.maxContentWidth(700), alignSelf: 'center',
  },
  list: { paddingHorizontal: andiSpace[5], paddingBottom: andiSpace[6], width: '100%', maxWidth: r.maxContentWidth(700), alignSelf: 'center' },
});
