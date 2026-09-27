import { View } from 'react-native';
import { searchUniversities } from '@/lib/universities';
import { Chip } from './Chip';
import { Field } from './Field';

/** حقل الجامعة مع اقتراحات من الجامعات السعودية أثناء الكتابة (ويقبل أي اسم آخر). */
export function UniversityField({ value, onChange, onPick, label = 'الجامعة' }: { value: string; onChange: (v: string) => void; onPick?: (v: string) => void; label?: string }) {
  const hits = searchUniversities(value);
  return (
    <View style={{ gap: 8 }}>
      <Field label={label} placeholder="اكتب اسم جامعتك" value={value} onChangeText={onChange} />
      {hits.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {hits.map((u) => (
            <Chip
              key={u}
              label={u}
              icon="school-outline"
              onPress={() => {
                onChange(u);
                onPick?.(u);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
