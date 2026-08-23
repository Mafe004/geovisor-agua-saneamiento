import React, { useState, useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { reportesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import GradientHeader from '../../components/GradientHeader';
import MapaWebView from '../../components/MapaWebView';

const ESTADOS_DISPONIBLES = [
  { key: 'PENDIENTE',   label: 'Pendiente'   },
  { key: 'EN_REVISION', label: 'En Revisión' },
  { key: 'EN_PROCESO',  label: 'En Proceso'  },
  { key: 'RESUELTO',    label: 'Resuelto'    },
  { key: 'RECHAZADO',   label: 'Rechazado'   },
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DetalleReporteScreen({ route, navigation }) {
  const { reporte: inicial } = route.params || {};
  const [reporte, setReporte] = useState(inicial);
  const [nuevoEstado, setNuevoEstado] = useState(inicial?.estado || '');
  const [comentario, setComentario] = useState('');
  const [updating, setUpdating] = useState(false);
  const { user, isModerador, isAdmin } = useContext(AuthContext);

  // Roles que pueden cambiar estado: entidad (2), moderador (3), admin (4)
  const canChangeStatus = isModerador || isAdmin || (user?.id_rol === 2);

  const handleUpdateEstado = async () => {
    if (!nuevoEstado || nuevoEstado === reporte.estado) {
      Alert.alert('Sin cambios', 'Selecciona un estado diferente al actual.');
      return;
    }
    try {
      setUpdating(true);
      await reportesAPI.cambiarEstado(reporte.id_reporte, {
        estado: nuevoEstado,
        comentario: comentario.trim() || undefined,
      });
      setReporte(r => ({ ...r, estado: nuevoEstado }));
      setComentario('');
      Alert.alert(
        '✅ Estado actualizado',
        `El reporte ahora está en: ${nuevoEstado.replace(/_/g, ' ')}`
      );
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.detail || 'No se pudo actualizar el estado.');
    } finally {
      setUpdating(false);
    }
  };

  if (!reporte) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No se encontró información del reporte.</Text>
      </View>
    );
  }

  // Verificar si hay coordenadas válidas
  const hasCoords =
    reporte.latitud != null &&
    reporte.longitud != null &&
    !(reporte.latitud === 0 && reporte.longitud === 0);

  // Construir marcador para el mapa (read-only, sin interacción)
  const mapaMarkers = hasCoords
    ? [{
        id: reporte.id_reporte,
        lat: parseFloat(reporte.latitud),
        lng: parseFloat(reporte.longitud),
        titulo: `Reporte #${reporte.id_reporte}`,
        descripcion: reporte.descripcion || '',
        severidad: reporte.severidad || 'MEDIA',
        estado: reporte.estado || 'PENDIENTE',
      }]
    : [];

  return (
    <View style={styles.container}>
      <GradientHeader
        title={`Reporte #${reporte.id_reporte}`}
        subtitle="Detalle del reporte"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} nestedScrollEnabled>
        {/* ── Badges de estado y severidad ── */}
        <View style={styles.badgeRow}>
          <StatusBadge status={reporte.estado} type="status" size="lg" />
          <StatusBadge status={reporte.severidad} type="severity" size="lg" />
        </View>

        {/* ── Descripción ── */}
        <Section title="📝 Descripción">
          <Text style={styles.description}>{reporte.descripcion || '—'}</Text>
        </Section>

        {/* ── Detalles ── */}
        <Section title="ℹ️ Detalles">
          <DetailRow label="Tipo de incidente" value={reporte.tipo_incidente || '—'} />
          <DetailRow label="Dirección" value={reporte.direccion_aproximada || 'No especificada'} />
          <DetailRow
            label="Reportado por"
            value={
              reporte.usuario_nombre
                ? `${reporte.usuario_nombre} ${reporte.usuario_apellido || ''}`.trim()
                : '—'
            }
          />
          <DetailRow label="Fecha reporte" value={formatDate(reporte.fecha_creacion)} />
          {reporte.fecha_actualizacion && (
            <DetailRow label="Última actualización" value={formatDate(reporte.fecha_actualizacion)} />
          )}
          {reporte.entidad_nombre && (
            <DetailRow label="Entidad asignada" value={reporte.entidad_nombre} />
          )}
        </Section>

        {/* ── Mapa (read-only) — NO necesita react-native-maps ── */}
        {hasCoords && (
          <Section title="📍 Ubicación">
            <MapaWebView
              style={styles.map}
              latitude={parseFloat(reporte.latitud)}
              longitude={parseFloat(reporte.longitud)}
              zoom={15}
              markers={mapaMarkers}
              showCenterPin={false}
              interactive={false}
            />
            <Text style={styles.coordText}>
              {parseFloat(reporte.latitud).toFixed(5)}, {parseFloat(reporte.longitud).toFixed(5)}
            </Text>
          </Section>
        )}

        {/* ── Cambiar estado — solo roles autorizados ── */}
        {canChangeStatus && (
          <Section title="🔄 Cambiar Estado">
            <View style={styles.estadoGrid}>
              {ESTADOS_DISPONIBLES.map(e => (
                <TouchableOpacity
                  key={e.key}
                  style={[
                    styles.estadoChip,
                    nuevoEstado === e.key && styles.estadoChipActive,
                    reporte.estado === e.key && styles.estadoChipCurrent,
                  ]}
                  onPress={() => setNuevoEstado(e.key)}
                >
                  <Text style={[
                    styles.estadoChipText,
                    nuevoEstado === e.key && styles.estadoChipTextActive,
                  ]}>
                    {e.label}{reporte.estado === e.key ? ' ✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.commentLabel}>Comentario (opcional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Ej: Se verificó el problema en campo…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={comentario}
              onChangeText={setComentario}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.updateBtn, updating && styles.updateBtnDisabled]}
              onPress={handleUpdateEstado}
              disabled={updating}
            >
              <LinearGradient
                colors={['#1565C0', '#00ACC1']}
                style={styles.updateBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {updating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.updateBtnText}>Guardar cambio</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Componentes auxiliares ── */

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/* ── Estilos ── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },

  description: { fontSize: 15, color: '#1F2937', lineHeight: 22 },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  detailValue: { fontSize: 13, color: '#1F2937', fontWeight: '500', flex: 1.5, textAlign: 'right' },

  // Mapa WebView (read-only)
  map: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  coordText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  // Chips de estado
  estadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  estadoChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  estadoChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  estadoChipCurrent: { borderColor: '#059669', borderWidth: 2 },
  estadoChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  estadoChipTextActive: { color: '#fff' },

  // Comentario y botón
  commentLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  commentInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#F9FAFB', padding: 10, fontSize: 13,
    color: '#1F2937', minHeight: 80,
  },
  updateBtn: { marginTop: 14, borderRadius: 12, overflow: 'hidden' },
  updateBtnDisabled: { opacity: 0.6 },
  updateBtnGrad: { height: 48, justifyContent: 'center', alignItems: 'center' },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
