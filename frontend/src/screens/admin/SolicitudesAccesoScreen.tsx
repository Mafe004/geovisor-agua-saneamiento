import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { solicitudesAccesoAPI } from '../../api/services';
import type { SolicitudAccesoItem } from '../../types/domain';
import type { RootStackParamList } from '../../navigation/types';
import { andiColors, andiType, andiRadius, andiElevation, andiSpace } from '../../theme/andi';

type Props = NativeStackScreenProps<RootStackParamList, 'SolicitudesAcceso'>;

const ESTADO_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  PENDIENTE: { bg: andiColors.warning100, fg: andiColors.warning700, label: 'Pendiente' },
  APROBADO: { bg: andiColors.success100, fg: andiColors.success700, label: 'Aprobado' },
  RECHAZADO: { bg: andiColors.error100, fg: andiColors.error700, label: 'Rechazado' },
};
const ESTADO_CHIP_DEFAULT = { bg: andiColors.neutral100, fg: andiColors.neutral600, label: 'Desconocido' };

// Formato manual (no Intl/toLocaleDateString) para que "DD/MM/YYYY HH:mm"
// no dependa de qué datos de locale trae disponibles el motor JS en cada
// plataforma -- ver el mismo problema resuelto a mano en
// AuditoriaScreen.tsx (acá con dos dígitos también en la hora/minuto).
function formatFecha(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function initials(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

export default function SolicitudesAccesoScreen({ navigation }: Props) {
  const [solicitudes, setSolicitudes] = useState<SolicitudAccesoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rechazarTarget, setRechazarTarget] = useState<SolicitudAccesoItem | null>(null);

  const [tokenModal, setTokenModal] = useState<{ token: string; nota: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const res = await solicitudesAccesoAPI.listar();
      setSolicitudes(res.data || []);
    } catch (err) {
      const msg = axios.isAxiosError<{ detail?: string }>(err) && err.response?.data?.detail;
      setLoadError(msg || 'No se pudieron cargar las solicitudes de acceso.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAprobar = async (item: SolicitudAccesoItem) => {
    setActionError(null);
    setActioningId(item.id);
    try {
      const res = await solicitudesAccesoAPI.aprobar(item.id);
      setTokenModal({ token: res.data.token_invitacion, nota: res.data.nota });
      setCopied(false);
      await load(true);
    } catch (err) {
      const msg = axios.isAxiosError<{ detail?: string }>(err) && err.response?.data?.detail;
      setActionError(msg || 'No se pudo aprobar la solicitud.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRechazarConfirmado = async () => {
    if (!rechazarTarget) return;
    setActionError(null);
    setActioningId(rechazarTarget.id);
    try {
      await solicitudesAccesoAPI.rechazar(rechazarTarget.id);
      setRechazarTarget(null);
      await load(true);
    } catch (err) {
      const msg = axios.isAxiosError<{ detail?: string }>(err) && err.response?.data?.detail;
      setActionError(msg || 'No se pudo rechazar la solicitud.');
      setRechazarTarget(null);
    } finally {
      setActioningId(null);
    }
  };

  const handleCopiar = async () => {
    if (!tokenModal) return;
    try {
      await Clipboard.setStringAsync(tokenModal.token);
      setCopied(true);
    } catch (_) {
      // Sin permiso/soporte de portapapeles en esta plataforma -- el token
      // sigue visible en pantalla para copiarlo a mano, así que no hace
      // falta bloquear el flujo por esto.
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#042F34', '#0A6F78']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Feather name="arrow-left" size={22} color={andiColors.surface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Solicitudes de acceso</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{solicitudes.length}</Text>
          </View>
        </View>
      </LinearGradient>

      {actionError && (
        <View style={styles.errorBanner}>
          <Feather name="alert-triangle" size={16} color={andiColors.error600} />
          <Text style={styles.errorBannerText}>{actionError}</Text>
          <TouchableOpacity onPress={() => setActionError(null)}>
            <Feather name="x" size={16} color={andiColors.error600} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={andiColors.primary600} />
        </View>
      ) : loadError ? (
        <View style={styles.loadingWrap}>
          <Feather name="alert-triangle" size={40} color={andiColors.error600} />
          <Text style={styles.loadErrorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[andiColors.primary600]} />
          }
          renderItem={({ item }) => {
            const chip = ESTADO_CHIP[item.estado] ?? ESTADO_CHIP_DEFAULT;
            const isExpanded = expandedIds.has(item.id);
            const motivoEsLargo = item.motivo.length > 90;
            const isActioning = actioningId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(item.nombre_completo)}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.nombre_completo}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{item.correo}</Text>
                  </View>
                  <View style={[styles.stateChip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.stateChipText, { color: chip.fg }]}>{chip.label}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={motivoEsLargo ? 0.7 : 1}
                  onPress={() => motivoEsLargo && toggleExpanded(item.id)}
                >
                  <Text style={styles.cardMotivo} numberOfLines={isExpanded ? undefined : 2}>
                    {item.motivo}
                  </Text>
                  {motivoEsLargo && (
                    <Text style={styles.expandLink}>{isExpanded ? 'Ver menos' : 'Ver más'}</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.cardMetaRow}>
                  <Feather name="clock" size={12} color={andiColors.onSurfaceVariant} />
                  <Text style={styles.cardMetaText}>{formatFecha(item.creado_en)}</Text>
                </View>
                {item.revisado_por_nombre && (
                  <View style={styles.cardMetaRow}>
                    <Feather name="user-check" size={12} color={andiColors.onSurfaceVariant} />
                    <Text style={styles.cardMetaText}>
                      Revisada por {item.revisado_por_nombre}
                      {item.revisado_en ? ` · ${formatFecha(item.revisado_en)}` : ''}
                    </Text>
                  </View>
                )}

                {item.estado === 'PENDIENTE' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, isActioning && styles.btnDisabled]}
                      onPress={() => setRechazarTarget(item)}
                      disabled={isActioning}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.rejectBtnText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, isActioning && styles.btnDisabled]}
                      onPress={() => handleAprobar(item)}
                      disabled={isActioning}
                      activeOpacity={0.8}
                    >
                      {isActioning
                        ? <ActivityIndicator size="small" color={andiColors.surface} />
                        : <Text style={styles.approveBtnText}>Aprobar</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={andiColors.onSurfaceVariant} />
              <Text style={styles.emptyStateText}>No hay solicitudes de acceso pendientes</Text>
            </View>
          }
        />
      )}

      {/* Confirmación de rechazo -- Modal, no Alert.alert (no dispara diálogo nativo bloqueante). */}
      <Modal visible={rechazarTarget !== null} transparent animationType="fade" onRequestClose={() => setRechazarTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Rechazar solicitud?</Text>
            <Text style={styles.modalMessage}>
              ¿Rechazar la solicitud de {rechazarTarget?.nombre_completo}?
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRechazarTarget(null)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={handleRechazarConfirmado}>
                <Text style={styles.modalRejectBtnText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Token de invitación tras aprobar. */}
      <Modal
        visible={tokenModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTokenModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Feather name="check-circle" size={32} color={andiColors.success600} style={{ alignSelf: 'center' }} />
            <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: andiSpace[2] }]}>
              Solicitud aprobada
            </Text>
            <Text style={[styles.modalMessage, { textAlign: 'center' }]}>
              Comparte este código con el solicitante:
            </Text>
            <Text style={styles.tokenText}>{tokenModal?.token}</Text>
            <Text style={styles.notaText}>{tokenModal?.nota}</Text>

            <TouchableOpacity style={styles.copyBtn} onPress={handleCopiar} activeOpacity={0.8}>
              <Feather name={copied ? 'check' : 'copy'} size={16} color={andiColors.primary600} />
              <Text style={styles.copyBtnText}>{copied ? 'Copiado' : 'Copiar código'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => { setTokenModal(null); load(true); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceMid },
  header: { paddingTop: andiSpace[10], paddingBottom: andiSpace[4], paddingHorizontal: andiSpace[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[2] },
  backBtn: { padding: andiSpace[1] },
  headerTitle: { flex: 1, ...andiType.headingMd, color: andiColors.surface },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: andiRadius.full, paddingHorizontal: andiSpace[3], paddingVertical: 2 },
  headerBadgeText: { ...andiType.labelSm, color: andiColors.surface },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: andiSpace[2],
    backgroundColor: andiColors.error50, borderBottomWidth: 1, borderBottomColor: andiColors.error200,
    paddingHorizontal: andiSpace[4], paddingVertical: andiSpace[2],
  },
  errorBannerText: { ...andiType.bodySm, color: andiColors.error700, flex: 1 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: andiSpace[6] },
  loadErrorText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3], textAlign: 'center' },
  retryBtn: { marginTop: andiSpace[4], backgroundColor: andiColors.primary600, borderRadius: andiRadius.full, paddingHorizontal: andiSpace[5], paddingVertical: andiSpace[2] },
  retryBtnText: { ...andiType.labelSm, color: andiColors.surface },

  listContent: { padding: andiSpace[4], paddingBottom: andiSpace[10] * 2 },

  card: {
    backgroundColor: andiColors.surface, borderRadius: andiRadius.md,
    padding: andiSpace[4], marginBottom: andiSpace[3], ...andiElevation[1],
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[3] },
  avatar: { width: 40, height: 40, borderRadius: andiRadius.full, backgroundColor: andiColors.primary100, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...andiType.labelSm, color: andiColors.primary700 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { ...andiType.labelMd, fontWeight: '700', color: andiColors.onSurface },
  cardEmail: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: 1 },
  stateChip: { borderRadius: andiRadius.full, paddingHorizontal: andiSpace[2], paddingVertical: 3 },
  stateChipText: { ...andiType.caption, fontWeight: '700' },

  cardMotivo: { ...andiType.bodySm, color: andiColors.onSurface, marginTop: andiSpace[3], lineHeight: 19 },
  expandLink: { ...andiType.caption, color: andiColors.primary600, fontWeight: '700', marginTop: andiSpace[1] },

  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[1], marginTop: andiSpace[2] },
  cardMetaText: { ...andiType.caption, color: andiColors.onSurfaceVariant },

  cardActions: { flexDirection: 'row', gap: andiSpace[3], marginTop: andiSpace[4] },
  rejectBtn: {
    flex: 1, height: 40, borderRadius: andiRadius.full, borderWidth: 1.5, borderColor: andiColors.error600,
    justifyContent: 'center', alignItems: 'center',
  },
  rejectBtnText: { ...andiType.labelSm, color: andiColors.error600 },
  approveBtn: {
    flex: 1, height: 40, borderRadius: andiRadius.full, backgroundColor: andiColors.primary600,
    justifyContent: 'center', alignItems: 'center',
  },
  approveBtnText: { ...andiType.labelSm, color: andiColors.surface },
  btnDisabled: { opacity: 0.5 },

  emptyState: { alignItems: 'center', paddingVertical: andiSpace[10] },
  emptyStateText: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[3], textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(14,20,22,0.5)', justifyContent: 'center', padding: andiSpace[6] },
  modalCard: { backgroundColor: andiColors.surface, borderRadius: andiRadius.lg, padding: andiSpace[5] },
  modalTitle: { ...andiType.headingMd, color: andiColors.onSurface },
  modalMessage: { ...andiType.bodySm, color: andiColors.onSurfaceVariant, marginTop: andiSpace[2] },
  modalBtnRow: { flexDirection: 'row', gap: andiSpace[3], marginTop: andiSpace[5] },
  modalCancelBtn: {
    flex: 1, height: 44, borderRadius: andiRadius.full, borderWidth: 1.5, borderColor: andiColors.outline,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelBtnText: { ...andiType.label, color: andiColors.onSurface },
  modalRejectBtn: { flex: 1, height: 44, borderRadius: andiRadius.full, backgroundColor: andiColors.error600, justifyContent: 'center', alignItems: 'center' },
  modalRejectBtnText: { ...andiType.label, color: andiColors.surface },

  tokenText: {
    ...andiType.headingLg, color: andiColors.primary700, textAlign: 'center',
    letterSpacing: 6, marginTop: andiSpace[4], fontWeight: '800',
  },
  notaText: { ...andiType.caption, color: andiColors.onSurfaceVariant, textAlign: 'center', marginTop: andiSpace[3] },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: andiSpace[2],
    marginTop: andiSpace[5], height: 44, borderRadius: andiRadius.full,
    borderWidth: 1.5, borderColor: andiColors.primary600,
  },
  copyBtnText: { ...andiType.label, color: andiColors.primary600 },
  modalCloseBtn: {
    marginTop: andiSpace[3], height: 44, borderRadius: andiRadius.full,
    backgroundColor: andiColors.primary600, justifyContent: 'center', alignItems: 'center',
  },
  modalCloseBtnText: { ...andiType.label, color: andiColors.surface },
});
