import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { reportesAPI, catalogosAPI, entidadesAPI } from '../../api/services';
import AndiHeader, { AndiHeaderIconButton } from '../../components/andi/AndiHeader';
import AndiBody from '../../components/andi/AndiBody';
import AndiChip from '../../components/andi/AndiChip';
import AndiReportCard from '../../components/andi/AndiReportCard';
import AndiStatusBadge from '../../components/andi/AndiStatusBadge';
import AndiEmptyState from '../../components/andi/AndiEmptyState';
import { AndiSkeletonList } from '../../components/andi/AndiSkeletonCard';
import TriageSheet from './TriageSheet';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';
import type { Reporte, EstadoReporteItem, EntidadDetalle } from '../../types/domain';

type Filtro = 'todos' | 'sin_revisar' | 'sin_entidad' | 'alta';

function coincide(r: Reporte, termino: string) {
  const t = termino.trim().toLowerCase();
  if (!t) return true;
  return [r.descripcion, r.direccion, r.usuario, r.tipo_incidente]
    .some(campo => (campo ?? '').toLowerCase().includes(t));
}

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

export default function TriageScreen() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [estadosDisponibles, setEstadosDisponibles] = useState<EstadoReporteItem[]>([]);
  const [entidades, setEntidades] = useState<EntidadDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let mounted = true;
    catalogosAPI.estadosReporte()
      .then(res => { if (mounted) setEstadosDisponibles(res.data || []); })
      .catch(() => { if (mounted) setEstadosDisponibles([]); });
    entidadesAPI.listar()
      .then(res => { if (mounted) setEntidades(res.data || []); })
      .catch(() => { if (mounted) setEntidades([]); });
    return () => { mounted = false; };
  }, []);

  const loadReportes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportesAPI.listar({ solo_activos: true });
      setReportes(res.data || []);
    } catch (_) {
      setReportes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadReportes(); }, [loadReportes]));

  const sinRevisar = reportes.filter(r => r.estado === 'PENDIENTE');
  const sinEntidad = reportes.filter(r => r.id_entidad == null);
  const altas = reportes.filter(r => r.severidad === 'ALTA' || r.severidad === 'CRITICA');

  const reportesFiltrados = (
    filtro === 'sin_revisar' ? sinRevisar :
    filtro === 'sin_entidad' ? sinEntidad :
    filtro === 'alta' ? altas :
    reportes
  ).filter(r => coincide(r, busqueda));

  const abrirTriage = (reporte: Reporte) => {
    setReporteSeleccionado(reporte);
    setSheetVisible(true);
  };

  const handleSaved = (actualizado: Reporte) => {
    setReportes(prev => prev.map(r => r.id_reporte === actualizado.id_reporte ? actualizado : r));
  };

  return (
    <View style={styles.container}>
      <AndiHeader
        overline="Bandeja · Zipaquirá"
        title="Por revisar"
        stats={[
          { value: sinRevisar.length, label: 'Sin revisar' },
          { value: sinEntidad.length, label: 'Sin entidad', color: andiColors.accent300 },
          { value: reportes.length, label: 'Abiertos' },
        ]}
        rightElement={
          <AndiHeaderIconButton
            icon={busquedaVisible ? 'x' : 'search'}
            onPress={() => {
              setBusquedaVisible(v => !v);
              if (busquedaVisible) setBusqueda('');
            }}
          />
        }
      />

      <AndiBody>
        {busquedaVisible && (
          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={andiColors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por descripción, dirección o ciudadano…"
              placeholderTextColor={andiColors.onSurfaceVariant}
              value={busqueda}
              onChangeText={setBusqueda}
              autoFocus
            />
          </View>
        )}

        <View style={styles.chipsRow}>
          <AndiChip label="Sin revisar" variant={filtro === 'sin_revisar' ? 'solid' : 'outline'} onPress={() => setFiltro(f => f === 'sin_revisar' ? 'todos' : 'sin_revisar')} />
          <AndiChip label={`Sin entidad · ${sinEntidad.length}`} variant="accent" onPress={() => setFiltro(f => f === 'sin_entidad' ? 'todos' : 'sin_entidad')} />
          <AndiChip label="Alta" variant={filtro === 'alta' ? 'solid' : 'outline'} onPress={() => setFiltro(f => f === 'alta' ? 'todos' : 'alta')} />
        </View>

        {loading ? (
          <View style={styles.list}>
            <AndiSkeletonList count={4} />
          </View>
        ) : reportesFiltrados.length === 0 ? (
          busqueda.trim() ? (
            <AndiEmptyState
              icon="search"
              title="Sin resultados"
              body={`Nada coincide con "${busqueda.trim()}" en este filtro.`}
              ctaLabel="Borrar búsqueda"
              onPressCta={() => setBusqueda('')}
            />
          ) : (
            <AndiEmptyState
              icon="check"
              title="Bandeja al día"
              body={`Nada sin revisar y nada sin entidad. Los ${reportes.length} reportes abiertos ya están en manos de alguien.`}
              ctaLabel="Ver los abiertos"
              onPressCta={() => setFiltro('todos')}
            />
          )
        ) : (
          <FlatList
            data={reportesFiltrados}
            keyExtractor={r => String(r.id_reporte)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const idLabel = `#${item.id_reporte} · ${formatRelative(item.created_at)}`;
              if (item.id_entidad == null) {
                return (
                  <AndiReportCard
                    variant="anchor"
                    idLabel={idLabel}
                    badge={
                      <View style={styles.flagBadge}>
                        <Feather name="flag" size={11} color={andiColors.n0} />
                        <Text style={styles.flagBadgeText}>Sin entidad</Text>
                      </View>
                    }
                    title={item.descripcion || 'Sin descripción'}
                    meta={`${item.direccion || '—'} · ${item.usuario || '—'}`}
                    severidad={item.severidad}
                    note={item.tipo_incidente ?? undefined}
                    primaryLabel="Triar ahora"
                    onPress={() => abrirTriage(item)}
                    onPrimaryPress={() => abrirTriage(item)}
                    onSecondaryPress={() => abrirTriage(item)}
                  />
                );
              }
              return (
                <AndiReportCard
                  idLabel={idLabel}
                  badge={<AndiStatusBadge status={item.estado} />}
                  title={item.descripcion || 'Sin descripción'}
                  meta={`${item.direccion || '—'} · ${item.usuario || '—'}`}
                  severidad={item.severidad}
                  onPress={() => abrirTriage(item)}
                  footerRight={
                    item.entidad_sugerida ? (
                      <Text style={styles.suggestedText}>→ {item.entidad_sugerida}</Text>
                    ) : null
                  }
                />
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: andiSpace[2] }} />}
          />
        )}
      </AndiBody>

      <TriageSheet
        visible={sheetVisible}
        reporte={reporteSeleccionado}
        estadosDisponibles={estadosDisponibles}
        entidades={entidades}
        onClose={() => setSheetVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[2],
    marginHorizontal: andiSpace[5], marginTop: andiSpace[4],
    backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg,
    paddingHorizontal: andiSpace[3], height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: andiColors.onSurface, height: '100%' },
  chipsRow: {
    flexDirection: 'row', gap: andiSpace[2],
    paddingHorizontal: andiSpace[5], paddingTop: andiSpace[4], paddingBottom: andiSpace[3],
  },
  list: { paddingHorizontal: andiSpace[5], paddingBottom: andiSpace[6] },
  flagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 20, borderRadius: andiRadius.full,
    backgroundColor: andiColors.accent500,
  },
  flagBadgeText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: andiColors.n0, textTransform: 'uppercase', letterSpacing: 0.8 },
  suggestedText: { fontSize: 12, lineHeight: 16, color: andiColors.onSurfaceVariant },
});
