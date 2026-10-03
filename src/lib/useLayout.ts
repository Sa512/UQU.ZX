import { useWindowDimensions } from 'react-native';

/** أقصى عرض للمحتوى: على الآيباد لا تتمدد البطاقات على كامل الشاشة. */
export const CONTENT_MAX = 860;

/** شاشة عريضة (آيباد، أو جوال أفقي كبير): شريط تبويب جانبي وأعمدة. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 768;
  return { width, height, wide, twoColumns: width >= 1000 };
}
