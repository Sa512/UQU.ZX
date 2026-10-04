import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { emailKind, emailSuggestions, isEmail, universityFromPartial, type AccountRole } from '@/lib/accounts';
import { useTheme } from '@/theme';

/**
 * الإيميل الجامعي مع إكمال سريع: بعد «@» يكفي اختصار الجامعة (uq أو ksu)،
 * فيظهر اسم الجامعة تحته فوراً واقتراح بالنطاق الكامل يُختار بضغطة.
 */
export function EmailField({ value, onChange, role = 'any', placeholder }: { value: string; onChange: (v: string) => void; role?: AccountRole | 'any'; placeholder?: string }) {
  const { colors } = useTheme();
  const hints = emailSuggestions(value, role);
  const known = isEmail(value) ? emailKind(value).university : undefined;
  const partial = known ? undefined : universityFromPartial(value);
  return (
    <View style={{ gap: 8 }}>
      <Field label="الإيميل الجامعي" placeholder={placeholder} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" ltr />
      {partial && (
        <AppText variant="caption" color={colors.primary}>
          🎓 {partial}
        </AppText>
      )}
      {hints.length > 0 && (
        <View accessibilityLabel="اقتراحات الإيميل" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {hints.map((h) => (
            <Chip key={h.email} label={`${h.email.split('@')[1]} · ${h.university}`} icon="school-outline" onPress={() => onChange(h.email)} />
          ))}
        </View>
      )}
    </View>
  );
}
