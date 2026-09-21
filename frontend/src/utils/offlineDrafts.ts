import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Borradores locales de "Crear reporte" para retomar un formulario a medio
 * llenar. A diferencia de Ciudadano_V1, NO hay cola de reintento automático
 * de envío ("en cola"/"Enviar ahora"): el backend no tiene client_uuid ni
 * endpoint de borradores, así que reintentar un POST fallido puede duplicar
 * el reporte — se prefiere que el usuario reintente manualmente.
 */
const DRAFTS_KEY = 'ciudadano_report_drafts_v1';

export interface ReporteDraftForm {
  descripcion: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  id_tipo_incidente: number | null;
  /**
   * Clave de severidad ('BAJA'|'MEDIA'|'ALTA'), no el id numérico del
   * catálogo -- así retomar un borrador no depende de que
   * catalogosAPI.severidades() ya esté cargado en memoria.
   */
  severidad: string | null;
  descTouched: boolean;
}

export interface ReporteDraft {
  id: string;
  tipoLabel: string;
  faltante?: string;
  guardadoEn: string;
  form: ReporteDraftForm;
}

function localId() {
  return `local_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function readList(): Promise<ReporteDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as ReporteDraft[]) : [];
  } catch (_) {
    return [];
  }
}

async function writeList(list: ReporteDraft[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
  } catch (_) {
    // ignorado a propósito: si AsyncStorage falla, el borrador simplemente
    // no persiste, no debe tumbar el formulario en memoria.
  }
}

export async function getDrafts(): Promise<ReporteDraft[]> {
  return readList();
}

export async function saveDraft(draft: Omit<ReporteDraft, 'id' | 'guardadoEn'> & { id?: string }): Promise<ReporteDraft> {
  const drafts = await getDrafts();
  const id = draft.id || localId();
  const next: ReporteDraft = { ...draft, id, guardadoEn: new Date().toISOString() };
  const withoutExisting = drafts.filter((d) => d.id !== id);
  withoutExisting.unshift(next);
  await writeList(withoutExisting);
  return next;
}

export async function removeDraft(id: string): Promise<void> {
  const drafts = await getDrafts();
  await writeList(drafts.filter((d) => d.id !== id));
}
