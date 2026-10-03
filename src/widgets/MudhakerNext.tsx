/**
 * ويدجت «مذاكر: التالي» لشاشة آيفون وآيباد الرئيسية وشاشة القفل.
 * تنبيه: الدالة المعلّمة بـ 'widget' تتحول نصاً وتُقيَّم داخل امتداد الويدجت، فلا تستخدم أي شيء من خارجها
 * (لا ثوابت ولا دوال من هذا الملف أو غيره) — فقط عناصر SwiftUI ومعدّلاتها المتاحة هناك.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { WidgetProps } from '@/lib/widgetData';

const MudhakerNext = (p: WidgetProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const fg = dark ? '#F8FAFC' : '#0F172A';
  const muted = dark ? '#A5B4FC' : '#64748B';
  const brand = dark ? '#A5B4FC' : '#4F46E5';
  const bg = containerBackground(dark ? '#1E1B4B' : '#FFFFFF', 'widget');
  const fam = env.widgetFamily;
  const L = p.lesson;
  const when = L ? (L.live ? 'الآن' : L.dayLabel) : '';

  // شاشة القفل: سطر واحد
  if (fam === 'accessoryInline') {
    return <Text>{L ? `${p.professor ? 'التالي' : 'محاضرتك'}: ${L.title} ${L.dayLabel || ''} ${L.time.split(' – ')[0]}` : 'لا مواعيد قادمة'}</Text>;
  }
  if (fam === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), lineLimit(1)]}>{L ? L.title : 'لا مواعيد قادمة'}</Text>
        {L ? <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{`${when ? when + ' · ' : ''}${L.time.split(' – ')[0]}${L.room ? ' · ' + L.room : ''}`}</Text> : null}
        {p.task ? <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{`${p.task.due}: ${p.task.title}`}</Text> : null}
      </VStack>
    );
  }

  const lesson = (
    <VStack alignment="leading" spacing={3}>
      <HStack spacing={5}>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(L ? L.color : brand)]}>{L ? (L.live ? `● ${L.kind} الآن` : L.kind) : 'مذاكر'}</Text>
        <Spacer />
        {L && !L.live && !L.dayLabel ? <Text date={new Date(L.at)} dateStyle="relative" modifiers={[font({ size: 11 }), foregroundStyle(muted)]} /> : null}
        {L && L.dayLabel ? <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>{L.dayLabel}</Text> : null}
      </HStack>
      <Text modifiers={[font({ size: fam === 'systemSmall' ? 16 : 18, weight: 'bold' }), foregroundStyle(fg), lineLimit(2)]}>{L ? L.title : 'لا مواعيد قادمة'}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}>{L ? L.time : 'أضف جدولك من التطبيق'}</Text>
      {L && L.room ? <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}>{`📍 ${L.room}`}</Text> : null}
      {p.laterToday > 0 ? <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>{`+${p.laterToday} مواعيد أخرى اليوم`}</Text> : null}
    </VStack>
  );

  const study = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(brand)]}>{p.professor ? 'اليوم' : 'مذاكرة اليوم'}</Text>
      <Text modifiers={[font({ size: 20, weight: 'bold' }), foregroundStyle(fg)]}>{`${p.studied} / ${p.goal} د`}</Text>
      {p.streak > 0 ? <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>{`🔥 متواصل ${p.streak} يوم`}</Text> : null}
    </VStack>
  );

  const task = p.task ? (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(p.task.overdue ? '#DC2626' : brand)]}>{p.professor ? `تصحيح · ${p.task.due}` : `تسليم · ${p.task.due}`}</Text>
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(fg), lineLimit(2)]}>{p.task.title}</Text>
    </VStack>
  ) : null;

  const exam = p.exam ? (
    <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#B45309'), lineLimit(1)]}>
      {p.exam.days === 0 ? `📝 ${p.exam.title} اليوم` : `📝 ${p.exam.title} بعد ${p.exam.days} يوم`}
    </Text>
  ) : null;

  if (fam === 'systemSmall') {
    return (
      <VStack alignment="leading" modifiers={[bg, widgetURL('mudhaker://schedule'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
        {lesson}
        <Spacer />
      </VStack>
    );
  }
  if (fam === 'systemMedium') {
    return (
      <HStack alignment="top" spacing={14} modifiers={[bg, widgetURL('mudhaker://schedule')]}>
        {lesson}
        <Spacer />
        <VStack alignment="leading" spacing={10}>
          {task ?? study}
          {task ? study : null}
        </VStack>
      </HStack>
    );
  }
  // الكبير والكبير جداً (آيباد)
  return (
    <VStack alignment="leading" spacing={14} modifiers={[bg, widgetURL('mudhaker://'), padding({ all: 4 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      {lesson}
      {exam}
      {fam === 'systemExtraLarge' ? (
        <HStack alignment="top" spacing={24}>
          {task}
          <Spacer />
          {study}
        </HStack>
      ) : (
        <VStack alignment="leading" spacing={12}>
          {task}
          {study}
        </VStack>
      )}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetProps>('MudhakerNext', MudhakerNext);
