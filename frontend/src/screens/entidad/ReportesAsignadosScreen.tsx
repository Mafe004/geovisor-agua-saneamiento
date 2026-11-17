import React, { useState, useCallback, useContext, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, type CompositeNavigationProp, type ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import axios from 'axios';
import { Feather } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { reportesAPI, catalogosAPI, entidadesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import AndiHeader from '../../components/andi/AndiHeader';
import ProfileAvatarButton from '../../components/andi/ProfileAvatarButton';
import AndiBody from '../../components/andi/AndiBody';
import AndiChip from '../../components/andi/AndiChip';
import AndiReportCard from '../../components/andi/AndiReportCard';
import AndiStatusBadge from '../../components/andi/AndiStatusBadge';
import AndiEmptyState from '../../components/andi/AndiEmptyState';
import AndiErrorState from '../../components/andi/AndiErrorState';
import { AndiSkeletonList } from '../../components/andi/AndiSkeletonCard';
import AsignarTrabajadorModal from '../../components/andi/AsignarTrabajadorModal';
import { useToast } from '../../components/andi/Toast';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';
import { useResponsive, type Responsive } from '../../theme/responsive';
import type { Reporte, EstadoReporteItem } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';

// CompositeNavigationProp + ParamListBase (no CiudadanoTabParamList/
// EntidadTabParamList aquí) porque esta pantalla necesita saltar al tab
// hermano "Crear" (vacío -> "Reportar un daño") además de subir al stack
// raíz -- mismo patrón que CrearReporteScreen.tsx.
type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<ParamListBase>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

type Filtro = 'abiertos' | 'alta' | 'cerrados' | 'todos';
type Vista = 'mios' | 'equipo';

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

export default function ReportesAsignadosScreen({ navigation }: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const toast = useToast();
  const { user } = useContext(AuthContext);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [entidadNombre, setEntidadNombre] = useState<string>('');
  const [estadosDisponibles, setEstadosDisponibles] = useState<EstadoReporteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('abiertos');
  const [vista, setVista] = useState<Vista>('mios');
  const [tomandoId, setTomandoId] = useState<number | null>(null);
  const [asignandoReporte, setAsignandoReporte] = useState<Reporte | null>(null);
  const [asignando, setAsignando] = useState(false);

  const loadReportes = useCallback(async () => {
    if (!user?.id_entidad) { setLoading(false); return; }
    setLoading(true);
    try {
      const [reportesRes, entidadRes] = await Promise.all([
        reportesAPI.listar(),
        entidadesAPI.detalle(user.id_entidad),
      ]);
      setReportes(reportesRes.data || []);
      setEntidadNombre(entidadRes.data.nombre_entidad);
    } catch (_) {
      setReportes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    loadReportes();
    catalogosAPI.estadosReporte()
      .then(res => setEstadosDisponibles(res.data || []))
      .catch(() => setEstadosDisponibles([]));
  }, [loadReportes]));

  if (!user?.id_entidad) {
    return (
      <View style={styles.container}>
        <AndiHeader
          title="Asignados"
          rightElement={<ProfileAvatarButton name={user?.nombre_completo ?? '?'} onPress={() => navigation.navigate('EntidadPerfil')} />}
        />
        <AndiBody>
          <AndiErrorState
            icon="alert-triangle"
            title="Tu cuenta no tiene entidad"
            body="Tu usuario es de tipo Entidad pero no está vinculado a ninguna. Sin ese vínculo no hay reportes que mostrarte. Un administrador debe asignarte una."
            code="403 · usuario ENTIDAD sin id_entidad"
            ctaLabel="Escribir al administrador"
            ctaVariant="outline"
            iconBg={andiColors.errorContainer}
            iconFg={andiColors.onErrorContainer}
          />
        </AndiBody>
      </View>
    );
  }

  // El titular ve todo el pool de la entidad y reparte trabajo; un
  // trabajador normal (migración 0007) solo ve lo suyo -- el backend ya
  // filtra reportesAPI.listar() así para él, así que "Equipo" ni siquiera
  // se muestra en ese caso (ver JSX más abajo).
  const esTitular = !!user?.es_titular_entidad;

  // "Mis reportes" = los que tengo asignados a mí; "Equipo" = todo el pool
  // de la entidad, igual que antes de que existiera el reparto por
  // trabajador (migración 0006) -- sigue sirviendo para ver qué está sin
  // repartir y asignárselo a alguien.
  const base = vista === 'mios'
    ? reportes.filter(r => r.id_usuario_asignado === user?.id_usuario)
    : reportes;

  const abiertos = base.filter(r => r.estado !== 'RESUELTO');
  const altas = base.filter(r => r.severidad === 'ALTA' || r.severidad === 'CRITICA');
  const cerrados = base.filter(r => r.estado === 'RESUELTO');
  const enProceso = base.filter(r => r.estado === 'EN_PROCESO');
  const porAtender = base.filter(r => r.estado === 'PENDIENTE' || r.estado === 'EN_REVISION');

  const reportesFiltrados =
    filtro === 'abiertos' ? abiertos :
    filtro === 'alta' ? altas :
    filtro === 'cerrados' ? cerrados :
    base;

  const handleTomar = async (reporte: Reporte) => {
    const enProcesoEstado = estadosDisponibles.find(e => e.nombre === 'EN_PROCESO');
    if (!enProcesoEstado || !user) return;
    try {
      setTomandoId(reporte.id_reporte);
      const res = await reportesAPI.cambiarEstado(reporte.id_reporte, {
        id_estado_nuevo: enProcesoEstado.id_estado,
        id_usuario_asignado: user.id_usuario,
      });
      setReportes(prev => prev.map(r => r.id_reporte === res.data.reporte.id_reporte ? res.data.reporte : r));
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo tomar el reporte.');
    } finally {
      setTomandoId(null);
    }
  };

  const handleAsignar = async (idUsuarioAsignado: number | null) => {
    if (!asignandoReporte) return;
    try {
      setAsignando(true);
      const res = await reportesAPI.asignarUsuario(asignandoReporte.id_reporte, { id_usuario_asignado: idUsuarioAsignado });
      setReportes(prev => prev.map(r => r.id_reporte === res.data.reporte.id_reporte ? res.data.reporte : r));
      toast.success(idUsuarioAsignado ? 'Asignado' : 'Desasignado', idUsuarioAsignado ? 'El reporte quedó asignado.' : 'El reporte vuelve al pool de la entidad.');
      setAsignandoReporte(null);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo asignar el reporte.');
    } finally {
      setAsignando(false);
    }
  };

  return (
    <View style={styles.container}>
      <AndiHeader
        overline={entidadNombre}
        title="Asignados"
        stats={[
          { value: porAtender.length, label: 'Por atender' },
          { value: enProceso.length, label: 'En proceso' },
          { value: cerrados.length, label: 'Cerrados' },
        ]}
        rightElement={<ProfileAvatarButton name={user?.nombre_completo ?? '?'} onPress={() => navigation.navigate('EntidadPerfil')} />}
      />

      <AndiBody>
        {esTitular && (
          <View style={styles.vistaRow}>
            <TouchableOpacity accessibilityRole="button" style={[styles.vistaTab, vista === 'mios' && styles.vistaTabActive]} onPress={() => setVista('mios')}>
              <Text style={[styles.vistaTabText, vista === 'mios' && styles.vistaTabTextActive]}>Mis reportes</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[styles.vistaTab, vista === 'equipo' && styles.vistaTabActive]} onPress={() => setVista('equipo')}>
              <Text style={[styles.vistaTabText, vista === 'equipo' && styles.vistaTabTextActive]}>Equipo · {entidadNombre || 'tu entidad'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.chipsRow}>
          <AndiChip label={`Abiertos · ${abiertos.length}`} variant={filtro === 'abiertos' ? 'solid' : 'outline'} onPress={() => setFiltro('abiertos')} />
          <AndiChip label="Alta" variant={filtro === 'alta' ? 'solid' : 'outline'} onPress={() => setFiltro('alta')} />
          <AndiChip label="Cerrados" variant={filtro === 'cerrados' ? 'solid' : 'outline'} onPress={() => setFiltro('cerrados')} />
        </View>

        {loading ? (
          <View style={styles.list}><AndiSkeletonList count={4} /></View>
        ) : reportesFiltrados.length === 0 ? (
          <AndiEmptyState
            icon="check"
            title="Nada pendiente"
            body={`Cerraste los ${cerrados.length} reportes que te llegaron este mes. Si ves un daño en campo, puedes reportarlo tú mismo.`}
            ctaLabel="Reportar un daño"
            ctaVariant="solid"
            onPressCta={() => navigation.navigate('Crear')}
          />
        ) : (
          <FlatList
            data={reportesFiltrados}
            keyExtractor={r => String(r.id_reporte)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const idLabel = item.estado === 'EN_PROCESO'
                ? `#${item.id_reporte} · asignado`
                : `#${item.id_reporte} · ${formatRelative(item.created_at)}`;
              const puedeTomar = item.estado === 'PENDIENTE' || item.estado === 'EN_REVISION';
              const esMio = item.id_usuario_asignado === user?.id_usuario;
              const nota = item.id_usuario_asignado == null
                ? 'Sin asignar'
                : esMio ? 'Tú lo tomaste' : `Lo tomó ${item.usuario_asignado ?? 'otro compañero'}`;

              if (item.estado === 'EN_PROCESO') {
                return (
                  <AndiReportCard
                    variant="anchor"
                    idLabel={idLabel}
                    badge={<AndiStatusBadge status={item.estado} onDark />}
                    title={item.descripcion || 'Sin descripción'}
                    meta={`${item.direccion || '—'} · ${item.usuario || '—'}`}
                    severidad={item.severidad}
                    note={nota}
                    primaryLabel="Cerrar reporte"
                    onPress={() => navigation.navigate('DetalleReporte', { reporte: item })}
                    onPrimaryPress={() => navigation.navigate('DetalleReporte', { reporte: item })}
                    onSecondaryPress={() => navigation.navigate('DetalleReporte', { reporte: item })}
                  />
                );
              }

              return (
                <AndiReportCard
                  idLabel={idLabel}
                  badge={<AndiStatusBadge status={item.estado} />}
                  title={item.descripcion || 'Sin descripción'}
                  meta={`${item.direccion || '—'} · ${item.usuario || '—'} · ${nota}`}
                  severidad={item.severidad}
                  onPress={() => navigation.navigate('DetalleReporte', { reporte: item })}
                  footerRight={
                    <View style={styles.footerActions}>
                      {esTitular && (
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Asignar a un compañero" style={styles.asignarBtn} onPress={() => setAsignandoReporte(item)}>
                          <Feather name="user-plus" size={14} color={andiColors.onSurfaceVariant} />
                        </TouchableOpacity>
                      )}
                      {puedeTomar && (
                        tomandoId === item.id_reporte ? (
                          <ActivityIndicator size="small" color={andiColors.primary} />
                        ) : (
                          <TouchableOpacity accessibilityRole="button" style={styles.tomarBtn} onPress={() => handleTomar(item)}>
                            <Text style={styles.tomarBtnText}>Tomar</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  }
                />
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: andiSpace[2] }} />}
          />
        )}
      </AndiBody>

      {!!user?.id_entidad && (
        <AsignarTrabajadorModal
          visible={!!asignandoReporte}
          onClose={() => setAsignandoReporte(null)}
          idEntidad={user.id_entidad}
          idUsuarioActual={asignandoReporte?.id_usuario_asignado ?? null}
          idUsuarioPropio={user.id_usuario}
          onElegir={handleAsignar}
          asignando={asignando}
        />
      )}
    </View>
  );
}

const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[2], paddingHorizontal: andiSpace[5], paddingTop: andiSpace[4], paddingBottom: andiSpace[3] },
  list: { paddingHorizontal: andiSpace[5], paddingBottom: andiSpace[6] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tomarBtn: {
    minHeight: 44, paddingHorizontal: andiSpace[4], borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary50, alignItems: 'center', justifyContent: 'center',
  },
  tomarBtnText: { fontSize: r.scaleFont(13), lineHeight: r.scaleFont(18), fontWeight: '600', color: andiColors.primary700 },

  vistaRow: { flexDirection: 'row', gap: andiSpace[2], paddingHorizontal: andiSpace[5], paddingTop: andiSpace[4] },
  vistaTab: {
    flex: 1, minHeight: 40, borderRadius: andiRadius.full, borderWidth: 1, borderColor: andiColors.outline,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: andiSpace[2],
  },
  vistaTabActive: { backgroundColor: andiColors.primary600, borderColor: andiColors.primary600 },
  vistaTabText: { fontSize: r.scaleFont(12), fontWeight: '600', color: andiColors.onSurface },
  vistaTabTextActive: { color: andiColors.surface },

  footerActions: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[2] },
  asignarBtn: {
    width: 36, height: 36, borderRadius: andiRadius.full, borderWidth: 1, borderColor: andiColors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
});
