import { StyleSheet } from 'react-native';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';
import type { Responsive } from '../../theme/responsive';

export const makeStyles = (r: Responsive) => StyleSheet.create({
  container: { flex: 1, backgroundColor: andiColors.surfaceDim },
  body: { padding: 0 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  detailLoadingOverlay: {
    position: 'absolute', top: andiSpace[3], right: andiSpace[3],
    backgroundColor: andiColors.surface, borderRadius: andiRadius.full, padding: andiSpace[2],
  },
  legendRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: andiSpace[3],
    paddingHorizontal: andiSpace[5], paddingVertical: andiSpace[3],
    backgroundColor: andiColors.surface, borderBottomWidth: 1, borderBottomColor: andiColors.outlineVariant,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: andiRadius.full },
  legendText: { fontSize: r.scaleFont(12), lineHeight: r.scaleFont(16), color: andiColors.onSurfaceVariant },

  anchorCard: {
    position: 'absolute', left: andiSpace[4], right: andiSpace[4], bottom: andiSpace[4],
    alignSelf: r.isTablet ? 'center' : undefined, width: r.isTablet ? r.maxContentWidth(480) : undefined,
    backgroundColor: andiColors.primary900, borderRadius: andiRadius.xl, padding: andiSpace[4],
  },
  anchorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: andiSpace[2] },
  anchorId: { fontSize: r.scaleFont(12), color: andiColors.primary200, fontWeight: '600' },
  anchorTitle: { fontSize: r.scaleFont(15), lineHeight: r.scaleFont(20), color: andiColors.surface, marginBottom: andiSpace[1] },
  anchorMeta: { fontSize: r.scaleFont(12), color: andiColors.primary200, marginBottom: andiSpace[3], textTransform: 'capitalize' },
  anchorBtn: { minHeight: 48, borderRadius: andiRadius.full, backgroundColor: andiColors.primary100, alignItems: 'center', justifyContent: 'center' },
  anchorBtnText: { color: andiColors.primary900, fontWeight: '700', fontSize: r.scaleFont(14) },
});
