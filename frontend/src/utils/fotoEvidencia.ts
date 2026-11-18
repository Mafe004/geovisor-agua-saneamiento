import { Platform } from 'react-native';
import type * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../api/client';

/**
 * imagen_url (reportes.imagen_url o historial_reportes.imagen_url) llega
 * relativa al mount /uploads del backend (/uploads/reportes/<uuid>.jpg) --
 * se antepone el mismo API_URL que usa axios. Una URL absoluta (filas
 * antiguas, si alguna vez se guardó una externa) se usa tal cual.
 */
export function uriImagenServidor(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${API_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

/**
 * Empaqueta una foto elegida con expo-image-picker como el multipart/form-data
 * que espera POST /reportes/imagen. Compartido por ciudadano/CrearReporteScreen
 * (foto del reporte) y entidad/DetalleReporteScreen (foto de la atención) --
 * mismo endpoint, mismo contrato, no duplicar esta lógica en cada pantalla.
 */
export async function construirFormFoto(foto: ImagePicker.ImagePickerAsset): Promise<FormData> {
  const form = new FormData();
  const name = foto.fileName || 'foto.jpg';
  const type = foto.mimeType || 'image/jpeg';
  if (Platform.OS === 'web') {
    const blob = await (await fetch(foto.uri)).blob();
    form.append('archivo', blob, name);
  } else {
    // El tipo TS de FormData es el del DOM y no conoce la forma {uri,name,type}.
    form.append('archivo', { uri: foto.uri, name, type } as unknown as Blob);
  }
  return form;
}

/**
 * Sube varias fotos una por una (no en paralelo, para no saturar la
 * conexión del celular con varias requests multipart a la vez) y devuelve
 * las rutas relativas en el mismo orden -- listas para el campo `imagenes`
 * de ReporteCreateRequest/CambiarEstadoRequest. Si una falla, propaga esa
 * excepción tal cual: el caller decide (igual que ya hace con la foto
 * única) si reintenta todo o sigue sin las fotos adicionales.
 */
export async function subirFotos(
  fotos: ImagePicker.ImagePickerAsset[],
  subirImagen: (form: FormData) => Promise<{ data: { imagen_url: string } }>
): Promise<string[]> {
  const urls: string[] = [];
  for (const foto of fotos) {
    const form = await construirFormFoto(foto);
    const { data } = await subirImagen(form);
    urls.push(data.imagen_url);
  }
  return urls;
}
