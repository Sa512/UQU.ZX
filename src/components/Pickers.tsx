import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { addDays, DAY_SHORT, formatMinutes, fromDateKey, MONTHS, toDateKey } from '@/lib/dates';
import { useStore } from '@/store/useStore';
import { courseColors, radius, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Chip, ChipRow } from './Chip';
import { haptic } from './haptics';

function RoundBtn({ icon, onPress, label, disabled }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 5, alignSelf: 'flex-start' }}>
      <RoundBtn icon="add" label="زيادة" disabled={value + step > max} onPress={() => onChange(Math.min(max, value + step))} />
      <AppText variant="h3" style={{ minWidth: 72, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {format ? format(value) : value}
      </AppText>
      <RoundBtn icon="remove" label="إنقاص" disabled={value - step < min} onPress={() => onChange(Math.max(min, value - step))} />
    </View>
  );
}

/** اختيار الوقت بخطوات ١٥ دقيقة (من ٦ صباحاً حتى ١١ مساءً). */
export function TimeStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <Stepper value={value} onChange={onChange} min={6 * 60} max={23 * 60} step={15} format={formatMinutes} />;
}

/** شريط أيام أفقي لاختيار تاريخ خلال الشهرين القادمين. */
export function DateStrip({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const { colors } = useTheme();
  const sel = fromDateKey(value);
  const today = new Date();
  const first = sel < today ? sel : today;
  const days = Array.from({ length: 60 }, (_, i) => addDays(first, i));
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="caption" muted>
        {MONTHS[sel.getMonth()]} {sel.getFullYear()}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => {
          const k = toDateKey(d);
          const active = k === value;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}
              onPress={() => {
                haptic.tap();
                onChange(k);
              }}
              style={{
                width: 58,
                paddingVertical: 10,
                borderRadius: radius.md,
                alignItems: 'center',
                gap: 2,
                backgroundColor: active ? colors.fill : colors.surface,
                borderWidth: 1.5,
                borderColor: active ? colors.fill : colors.border,
              }}
            >
              <AppText variant="tiny" color={active ? '#FFFFFFCC' : colors.textMuted}>
                {DAY_SHORT[d.getDay()]}
              </AppText>
              <AppText variant="h3" color={active ? '#FFFFFF' : colors.text}>
                {d.getDate()}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {courseColors.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="button"
          accessibilityLabel="لون"
          accessibilityState={{ selected: value === c }}
          onPress={() => {
            haptic.tap();
            onChange(c);
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: value === c ? colors.text : 'transparent',
          }}
        >
          {value === c && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
        </Pressable>
      ))}
    </View>
  );
}

export function CoursePicker({ value, onChange, allowNone = true }: { value: string | null; onChange: (id: string | null) => void; allowNone?: boolean }) {
  const courses = useStore((s) => s.courses);
  return (
    <ChipRow>
      {allowNone && <Chip label="عام" selected={value === null} onPress={() => onChange(null)} />}
      {courses.map((c) => (
        <Chip key={c.id} label={c.name} color={c.color} selected={value === c.id} onPress={() => onChange(c.id)} />
      ))}
    </ChipRow>
  );
}
