import React, { useState, useCallback, useContext, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, type CompositeNavigationProp, type ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { reportesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import AndiHeader from '../../components/andi/AndiHeader';
import ProfileAvatarButton from '../../components/andi/ProfileAvatarButton';
import AndiBody from '../../components/andi/AndiBody';
import AndiErrorState from '../../components/andi/AndiErrorState';
import MapaWebView from '../../components/MapaWebView';
import { useToast } from '../../components/andi/Toast';
import { andiColors } from '../../theme/andi';
import type { MapMarker } from '../../components/MapaWebView.types';
import type { ReporteMapaPunto } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';
import { makeStyles } from './MapaEntidadScreen.styles';
import { useResponsive } from '../../theme/responsive';

// Mismo patrón de navigation prop que ReportesAsignadosScreen.tsx: este tab
// necesita subir al stack raíz (DetalleReporte), así que se tipa con
// ParamListBase en vez de EntidadTabParamList (no navega a tabs hermanos).
type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<ParamListBase>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

const LEGEND: { estado: string; label: string; color: string }[] = [
  { estado: 'PENDIENTE', label: 'Pendiente', color: andiColors.stPendBd },
  { estado: 'EN_REVISION', label: 'En revisión', color: andiColors.stRevBd },
  { estado: 'EN_PROCESO', label: 'En proceso', color: andiColors.stProBd },
  { estado: 'RESUELTO', label: 'Resuelto', color: andiColors.stResBd },
];

export default function MapaEntidadScreen({ navigation }: Props) {
  const r = useResponsive();
  const styles = useMemo(() => makeStyles(r), [r]);
  const toast = useToast();
  const { user } = useContext(AuthContext);
  const [puntos, setPuntos] = useState<ReporteMapaPunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState<number | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapMarker | null>(null);

  const loadPuntos = useCallback(async () => {
    if (!user?.id_entidad) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await reportesAPI.mapa();
      setPuntos(res.data || []);
    } catch (_) {
      setPuntos([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id_entidad]);

  useFocusEffect(useCallback(() => { loadPuntos(); }, [loadPuntos]));

  if (!user?.id_entidad) {
    return (
      <View style={styles.container}>
        <AndiHeader title="Mapa" rightElement={<ProfileAvatarButton name={user?.nombre_completo ?? '?'} onPress={() => navigation.navigate('EntidadPerfil')} />} />
        <AndiBody>
          <AndiErrorState
            icon="alert-triangle"
            title="Tu cuenta no tiene entidad"
            body="Tu usuario es de tipo Entidad pero no está vinculado a ninguna, así que no hay reportes que ubicar en el mapa."
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

  // GET /reportes/mapa ya viene escopado por id_entidad en el backend
  // (scope_reportes) -- no hace falta filtrar de nuevo en el cliente.
  const markers: MapMarker[] = puntos.map(p => ({
    id: p.id_reporte,
    id_reporte: p.id_reporte,
    lat: p.latitud,
    lng: p.longitud,
    titulo: `#${p.id_reporte}`,
    descripcion: p.direccion || p.tipo_incidente,
    estado: p.estado,
    severidad: p.severidad,
  }));

  const handleMarkerPress = (marker: MapMarker) => {
    setSelectedPin(marker);
  };

  const verDetalle = async (idReporte: number | undefined) => {
    if (idReporte == null) return;
    try {
      setCargandoDetalle(idReporte);
      const res = await reportesAPI.obtener(idReporte);
      navigation.navigate('DetalleReporte', { reporte: res.data });
      setSelectedPin(null);
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      toast.error('Error', msg || 'No se pudo abrir el detalle de este reporte.');
    } finally {
      setCargandoDetalle(null);
    }
  };

  return (
    <View style={styles.container}>
      <AndiHeader
        title="Mapa"
        overline={`${puntos.length} reporte${puntos.length === 1 ? '' : 's'}`}
        rightElement={<ProfileAvatarButton name={user?.nombre_completo ?? '?'} onPress={() => navigation.navigate('EntidadPerfil')} />}
      />
      <AndiBody style={styles.body}>
        <View style={styles.legendRow}>
          {LEGEND.map(l => (
            <View key={l.estado} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={andiColors.primary} />
          </View>
        ) : (
          <View style={styles.map}>
            <MapaWebView
              style={styles.map}
              markers={markers}
              zoom={13}
              interactive
              showCenterPin={false}
              onMarkerPress={handleMarkerPress}
            />
            {selectedPin && (
              <View style={styles.anchorCard}>
                <View style={styles.anchorTop}>
                  <Text style={styles.anchorId}>Reporte #{selectedPin.id_reporte}</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setSelectedPin(null)}>
                    <Feather name="x" size={18} color={andiColors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.anchorTitle} numberOfLines={2}>{selectedPin.descripcion || selectedPin.titulo || 'Reporte'}</Text>
                {!!selectedPin.estado && <Text style={styles.anchorMeta}>{selectedPin.estado.replace(/_/g, ' ')}</Text>}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.anchorBtn}
                  onPress={() => verDetalle(selectedPin.id_reporte)}
                  disabled={cargandoDetalle != null}
                >
                  {cargandoDetalle != null
                    ? <ActivityIndicator size="small" color={andiColors.surface} />
                    : <Text style={styles.anchorBtnText}>Ver detalle</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </AndiBody>
    </View>
  );
}
