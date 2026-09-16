import React, { useState, useContext, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { reportesAPI, entidadesAPI } from '../../api/services';
import { AuthContext } from '../../context/AuthContext';
import AndiHeader from '../../components/andi/AndiHeader';
import AndiBody from '../../components/andi/AndiBody';
import { andiColors, andiRadius, andiSpace, andiType, andiOverlineDecor, andiStatusPill, andiSeverityColor } from '../../theme/andi';
import type { EstadisticasResponse } from '../../types/domain';

const MES_LABEL: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function mesLabel(mes: string) {
  const [, m] = mes.split('-');
  return m ? (MES_LABEL[m] ?? mes) : mes;
}

function cap(s: string) {
  return s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

export default function CifrasEntidadScreen() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [entidadNombre, setEntidadNombre] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, entRes] = await Promise.all([
        reportesAPI.estadisticas(),
        user?.id_entidad ? entidadesAPI.detalle(user.id_entidad) : Promise.resolve(null),
      ]);
      setStats(statsRes.data);
      if (entRes) setEntidadNombre(entRes.data.nombre_entidad);
    } catch (_) {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id_entidad]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const porEstado = stats?.por_estado ?? [];
  const porSeveridad = stats?.por_severidad ?? [];
  const porMes = stats?.por_mes ?? [];
  const maxEstado = Math.max(1, ...porEstado.map(e => e.total));
  const maxMes = Math.max(1, ...porMes.map(m => m.total));

  return (
    <View style={styles.container}>
      <AndiHeader
        title="Cifras"
        subtitle={`Solo ${entidadNombre || 'tu entidad'} · últimos 6 meses`}
      />

      <AndiBody>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={andiColors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Por estado</Text>
            <View style={{ gap: andiSpace[2] }}>
              {['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO'].map(nombre => {
                const row = porEstado.find(e => e.estado === nombre);
                const total = row?.total ?? 0;
                const pct = Math.round((total / maxEstado) * 100);
                const color = andiStatusPill[nombre]?.bd ?? andiColors.outline;
                return (
                  <View key={nombre} style={styles.barRow}>
                    <Text style={[andiType.caption, styles.barLabel]}>{andiStatusPill[nombre]?.label ?? nombre}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.barCount}>{total}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Por severidad</Text>
            <View style={styles.severidadRow}>
              {['BAJA', 'MEDIA', 'ALTA'].map(nombre => {
                const row = porSeveridad.find(s => s.severidad === nombre);
                return (
                  <View key={nombre} style={styles.severidadCard}>
                    <View style={styles.severidadHeader}>
                      <View style={[styles.dot10, { backgroundColor: andiSeverityColor[nombre] }]} />
                      <Text style={[andiType.overline, styles.severidadLabel]}>{cap(nombre)}</Text>
                    </View>
                    <Text style={andiType.display}>{row?.total ?? 0}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={[andiType.overline, andiOverlineDecor, styles.sectionLabel]}>Por mes</Text>
            <View style={styles.mesChart}>
              {porMes.map((m, i) => (
                <View key={i} style={styles.mesCol}>
                  <View style={[
                    styles.mesBar,
                    {
                      height: `${Math.max(6, Math.round((m.total / maxMes) * 100))}%`,
                      backgroundColor: interpolatePrimary(m.total / maxMes),
                    },
                  ]} />
                  <Text style={[andiType.overline, styles.mesLabel]}>{mesLabel(m.mes)}</Text>
                </View>
              ))}
            </View>

            <Text style={[andiType.caption, styles.footerNote]}>
              Todo sale de /reportes/estadisticas, ya filtrado por tu entidad en el servidor.
            </Text>
          </ScrollView>
        )}
      </AndiBody>
    </View>
  );
}

function interpolatePrimary(t: number) {
  const stops = [andiColors.primary200, andiColors.primary300, andiColors.primary400, andiColors.primary500, andiColors.primary600];
  const idx = Math.min(stops.length - 1, Math.floor(t * stops.length));
  return stops[idx] ?? andiColors.primary400;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: andiSpace[5], paddingTop: andiSpace[5], paddingBottom: andiSpace[8] },
  sectionLabel: { color: andiColors.onSurfaceVariant, marginBottom: andiSpace[3], marginTop: andiSpace[2] },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: andiSpace[3] },
  barLabel: { width: 88, flexShrink: 0, color: andiColors.onSurface },
  barTrack: { flex: 1, height: 24, borderRadius: andiRadius.full, backgroundColor: andiColors.surfaceMid, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: andiRadius.full },
  barCount: { width: 24, textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: '600', color: andiColors.onSurface },

  severidadRow: { flexDirection: 'row', gap: andiSpace[2] },
  severidadCard: { flex: 1, backgroundColor: andiColors.surfaceMid, borderRadius: andiRadius.lg, padding: andiSpace[3] },
  severidadHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot10: { width: 10, height: 10, borderRadius: 5 },
  severidadLabel: { color: andiColors.onSurfaceVariant },

  mesChart: { flexDirection: 'row', alignItems: 'flex-end', gap: andiSpace[2], height: 120 },
  mesCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  mesBar: { width: '100%', borderTopLeftRadius: andiRadius.sm, borderTopRightRadius: andiRadius.sm },
  mesLabel: { color: andiColors.onSurfaceVariant },

  footerNote: { color: andiColors.onSurfaceVariant, marginTop: andiSpace[5] },
});
