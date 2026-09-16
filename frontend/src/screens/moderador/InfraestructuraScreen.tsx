import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { infraestructuraAPI } from '../../api/services';
import AndiHeader, { AndiHeaderIconButton } from '../../components/andi/AndiHeader';
import AndiBody from '../../components/andi/AndiBody';
import AndiChip from '../../components/andi/AndiChip';
import AndiEmptyState from '../../components/andi/AndiEmptyState';
import MapaWebView from '../../components/MapaWebView';
import type { MapMarker, MapCenterChange } from '../../components/MapaWebView.types';
import { andiColors, andiRadius, andiSpace, andiType, andiElevation } from '../../theme/andi';
import type { InfraestructuraItem } from '../../types/domain';

const ZIPAQUIRA = { latitude: 5.0231, longitude: -74.0041 };
const TIPOS = ['PTAR', 'ACUEDUCTO', 'POZO', 'EMBALSE', 'ALCANTARILLADO'];
const ESTADOS = ['ACTIVA', 'INACTIVA', 'EN_MANTENIMIENTO'];
// Un tono distinto de la rampa primary por tipo -- mismo lenguaje visual
// que el canvas (PT/AC/PZ/AL en distintos primary-4/5/6/700).
const TIPO_SHADE: Record<string, string> = {
  PTAR: andiColors.primary600,
  ACUEDUCTO: andiColors.primary500,
  POZO: andiColors.primary400,
  EMBALSE: andiColors.primary300,
  ALCANTARILLADO: andiColors.primary700,
};

function shortCode(tipo: string) {
  return tipo.slice(0, 2).toUpperCase();
}

export default function InfraestructuraScreen() {
  const [items, setItems] = useState<InfraestructuraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await infraestructuraAPI.listar();
      setItems(res.data || []);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fuentes = Array.from(new Set(items.map(i => i.fuente).filter(Boolean)));
  const itemsFiltrados = filtroTipo ? items.filter(i => i.tipo === filtroTipo) : items;

  const markers: MapMarker[] = items.map(i => ({
    id: i.id_infraestructura,
    lat: i.latitud,
    lng: i.longitud,
    titulo: i.nombre,
    descripcion: i.tipo,
    color: TIPO_SHADE[i.tipo] ?? andiColors.primary600,
    shape: 'square',
    label: shortCode(i.tipo),
  }));

  return (
    <View style={styles.container}>
      <AndiHeader
        title="Infraestructura"
        subtitle={`${items.length} puntos${fuentes.length ? ` · fuentes ${fuentes.join(', ')}` : ''}`}
        rightElement={<AndiHeaderIconButton icon="plus" background={andiColors.accent500} onPress={() => setFormVisible(true)} />}
      />

      <AndiBody>
        {items[0] && (
          <MapaWebView
            style={styles.map}
            latitude={items[0].latitud}
            longitude={items[0].longitud}
            zoom={13}
            markers={markers}
            interactive={false}
            showCenterPin={false}
          />
        )}

        <View style={styles.chipsRow}>
          <AndiChip label="Todas" variant={filtroTipo === null ? 'solid' : 'outline'} onPress={() => setFiltroTipo(null)} />
          {TIPOS.map(t => (
            <AndiChip key={t} label={cap(t)} variant={filtroTipo === t ? 'solid' : 'outline'} onPress={() => setFiltroTipo(t)} />
          ))}
        </View>

        {!loading && itemsFiltrados.length === 0 ? (
          <AndiEmptyState
            icon="map-pin"
            title="Sin infraestructura registrada"
            body="Agrega el primer punto con el botón de arriba."
          />
        ) : (
          <FlatList
            data={itemsFiltrados}
            keyExtractor={i => String(i.id_infraestructura)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <InfraCard item={item} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[andiColors.primary]} />
            }
            ItemSeparatorComponent={() => <View style={{ height: andiSpace[2] }} />}
          />
        )}
      </AndiBody>

      <InfraestructuraForm
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onCreated={() => { setFormVisible(false); load(true); }}
      />
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function InfraCard({ item }: { item: InfraestructuraItem }) {
  const isActiva = item.estado === 'ACTIVA';
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: TIPO_SHADE[item.tipo] ?? andiColors.primary600 }]}>
        <Text style={styles.cardIconText}>{shortCode(item.tipo)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[andiType.label, styles.cardTitle]}>{item.nombre}</Text>
        <Text style={[andiType.caption, styles.cardMeta]}>
          {cap(item.tipo)}{item.fuente ? ` · ${item.fuente}` : ''}
        </Text>
      </View>
      <View style={[styles.statusTag, !isActiva && styles.statusTagInactive]}>
        <Text style={[styles.statusTagText, !isActiva && styles.statusTagTextInactive]}>
          {item.estado ? cap(item.estado) : 'Sin estado'}
        </Text>
      </View>
    </View>
  );
}

function InfraestructuraForm({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<string | null>(null);
  const [fuente, setFuente] = useState('');
  const [estado, setEstado] = useState<string>('ACTIVA');
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setNombre(''); setTipo(null); setFuente(''); setEstado('ACTIVA'); setCoordenadas(null);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) { Alert.alert('Requerido', 'Ingresa un nombre.'); return; }
    if (!tipo) { Alert.alert('Requerido', 'Selecciona un tipo.'); return; }
    if (!coordenadas) { Alert.alert('Requerido', 'Marca la ubicación en el mapa.'); return; }

    try {
      setSaving(true);
      await infraestructuraAPI.crear({
        nombre: nombre.trim(),
        tipo,
        latitud: coordenadas.latitude,
        longitud: coordenadas.longitude,
        fuente: fuente.trim() || null,
        estado,
      });
      reset();
      onCreated();
    } catch (e) {
      const msg = axios.isAxiosError<{ detail?: string }>(e) && e.response?.data?.detail;
      Alert.alert('Error', msg || 'No se pudo crear la infraestructura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kbWrap}>
          <View style={[styles.formCard, andiElevation[4]]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.handle} />
              <View style={styles.formHeader}>
                <Text style={andiType.section}>Nueva infraestructura</Text>
              </View>

              <Text style={styles.formLabel}>Nombre *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: PTAR El Espino"
                placeholderTextColor={andiColors.onSurfaceVariant}
                value={nombre}
                onChangeText={setNombre}
              />

              <Text style={styles.formLabel}>Tipo *</Text>
              <View style={styles.chipsRow}>
                {TIPOS.map(t => (
                  <AndiChip key={t} label={t} variant={tipo === t ? 'solid' : 'outline'} onPress={() => setTipo(t)} />
                ))}
              </View>

              <Text style={styles.formLabel}>Estado</Text>
              <View style={styles.chipsRow}>
                {ESTADOS.map(e => (
                  <AndiChip key={e} label={e} variant={estado === e ? 'solid' : 'outline'} onPress={() => setEstado(e)} />
                ))}
              </View>

              <Text style={styles.formLabel}>Fuente del dato (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: SIASAR"
                placeholderTextColor={andiColors.onSurfaceVariant}
                value={fuente}
                onChangeText={setFuente}
              />

              <Text style={styles.formLabel}>Ubicación *</Text>
              <Text style={[andiType.caption, styles.mapHint]}>Arrastra el mapa hasta ubicar el punto exacto</Text>
              <MapaWebView
                style={styles.formMap}
                latitude={coordenadas ? coordenadas.latitude : ZIPAQUIRA.latitude}
                longitude={coordenadas ? coordenadas.longitude : ZIPAQUIRA.longitude}
                zoom={14}
                showCenterPin
                onCenterChange={(c: MapCenterChange) => setCoordenadas(c)}
                markers={[]}
              />
              {coordenadas && (
                <Text style={[andiType.caption, styles.coordText]}>
                  {coordenadas.latitude.toFixed(5)}, {coordenadas.longitude.toFixed(5)}
                </Text>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onClose(); }}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, andiElevation[2], saving && styles.saveBtnDisabled]}
                  onPress={handleGuardar}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={andiColors.n0} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  map: { height: 230, marginHorizontal: 0 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[2], paddingHorizontal: andiSpace[5], paddingVertical: andiSpace[3] },
  list: { paddingHorizontal: andiSpace[5], paddingBottom: andiSpace[6] },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[3],
    backgroundColor: andiColors.surface, borderWidth: 1, borderColor: andiColors.outlineVariant,
    borderRadius: andiRadius.lg, padding: andiSpace[3],
  },
  cardIcon: { width: 36, height: 36, borderRadius: andiRadius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardIconText: { fontSize: 12, lineHeight: 12, fontWeight: '600', color: andiColors.n0 },
  cardTitle: { color: andiColors.onSurface },
  cardMeta: { color: andiColors.onSurfaceVariant, marginTop: 2 },
  statusTag: { backgroundColor: andiColors.successContainer, borderRadius: andiRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusTagInactive: { backgroundColor: andiColors.surfaceMid },
  statusTagText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: andiColors.onSuccessContainer, textTransform: 'uppercase' },
  statusTagTextInactive: { color: andiColors.onSurfaceVariant },

  overlay: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'flex-end' },
  kbWrap: { width: '100%' },
  formCard: {
    backgroundColor: andiColors.surface, borderTopLeftRadius: andiRadius['2xl'], borderTopRightRadius: andiRadius['2xl'],
    paddingHorizontal: andiSpace[5], paddingTop: andiSpace[3], paddingBottom: andiSpace[6], width: '100%', maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: andiRadius.full, backgroundColor: andiColors.outline, alignSelf: 'center', marginBottom: andiSpace[4] },
  formHeader: { marginBottom: andiSpace[2] },
  formLabel: { fontSize: 13, fontWeight: '600', color: andiColors.onSurface, marginBottom: andiSpace[2], marginTop: andiSpace[3] },
  input: {
    borderWidth: 1, borderColor: andiColors.outlineVariant, borderRadius: andiRadius.full,
    backgroundColor: andiColors.surfaceMid, paddingHorizontal: andiSpace[4], height: 44, fontSize: 14, color: andiColors.onSurface,
  },
  mapHint: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[2] },
  formMap: { height: 180, borderRadius: andiRadius.lg, overflow: 'hidden' },
  coordText: { color: andiColors.onSurfaceVariant, marginTop: andiSpace[2], textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: andiSpace[2], marginTop: andiSpace[5] },
  cancelBtn: { minHeight: 56, paddingHorizontal: andiSpace[5], borderRadius: andiRadius.full, borderWidth: 1, borderColor: andiColors.outline, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: andiColors.onSurface },
  saveBtn: { flex: 1, minHeight: 56, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: andiColors.n0 },
});
