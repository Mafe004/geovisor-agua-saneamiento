import { StyleSheet } from 'react-native';
import { andiColors, andiRadius, andiSpace } from '../../theme/andi';

export const styles = StyleSheet.create({
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
  legendText: { fontSize: 12, lineHeight: 16, color: andiColors.onSurfaceVariant },
});
