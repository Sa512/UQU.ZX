import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export const textFileSupported = true;

/** يختار ملفاً نصياً (CSV/TXT) ويعيد محتواه، أو null عند الإلغاء. */
export async function pickTextFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'text/tab-separated-values', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  try {
    return await new File(res.assets[0].uri).text();
  } catch {
    return null;
  }
}
