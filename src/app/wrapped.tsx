import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  PixelRatio,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { haptic } from "@/components/haptics";
import { Screen } from "@/components/Screen";
import { ShareCard } from "@/components/ShareCard";
import { captureSupported, shareCardImage } from "@/lib/capture";
import { useNow } from "@/lib/useNow";
import {
  computeWrapped,
  DEFAULT_WINDOW_DAYS,
  wrappedSlides,
} from "@/lib/wrapped";
import { useStore } from "@/store/useStore";
import { spacing } from "@/theme";

/** «ملخص فصلك»: شرائح ستوري، اضغط يساراً للتالي ويميناً للسابق (اتجاه القراءة العربي). */
export default function WrappedScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const courses = useStore((s) => s.courses);
  const name = useStore((s) => s.settings.name);
  const startedAt = useStore((s) => s.settings.semesterStartedAt);
  const now = useNow();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const ref = useRef<View>(null);

  const since = startedAt ?? now - DEFAULT_WINDOW_DAYS * 86_400_000;
  const w = computeWrapped({ sessions, tasks, courses, since, now });

  if (w.sessions === 0) {
    return (
      <Screen back title="ملخص فصلك">
        <EmptyState
          icon="sparkles-outline"
          title="ملخصك يتجهّز مع كل جلسة"
          message="ابدأ جلسات المذاكرة من المؤقت، وارجع هنا لتشوف فصلك بالأرقام وتشاركه."
          action={{
            title: "ابدأ المذاكرة",
            onPress: () => router.navigate("/focus"),
          }}
        />
      </Screen>
    );
  }

  const slides = wrappedSlides(w, name);
  const idx = Math.min(i, slides.length - 1);
  const slide = slides[idx];
  // الشريحة بأكبر مساحة تسمح بها الشاشة مع ترك مكان للأزرار
  const cardW = Math.min(
    width,
    ((height - insets.top - insets.bottom - 120) * 9) / 16,
  );
  const go = (d: number) => {
    setMsg(undefined);
    setI((v) => Math.max(0, Math.min(slides.length - 1, v + d)));
    haptic.tap();
  };
  const share = async () => {
    setBusy(true);
    const r = await shareCardImage(ref);
    setBusy(false);
    if (r.ok) haptic.success();
    else setMsg(r.message);
  };

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS !== "web" && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <ShareCard ref={ref} data={slide} width={1080 / PixelRatio.get()} />
        </View>
      )}
      {/* طبقة معتمة فوق النسخة المخفية المعدّة للالتقاط */}
      <View
        style={{
          flex: 1,
          backgroundColor: "#0B1020",
          paddingTop: insets.top,
          paddingBottom: insets.bottom + spacing.md,
        }}
      >
        {/* شريط التقدم */}
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}
        >
          {slides.map((_, k) => (
            <View
              key={k}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor:
                  k <= idx ? "#FFFFFF" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <AppText variant="label" color="#FFFFFF">
            ملخص فصلك · {idx + 1}/{slides.length}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
            hitSlop={10}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ borderRadius: 20, overflow: "hidden" }}>
            <ShareCard data={slide} width={cardW} />
          </View>
          {/* مناطق اللمس: الواجهة من اليمين لليسار، فالعنصر الأول يمين (السابق) والثاني يسار (التالي) */}
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: "row",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الشريحة السابقة"
              style={{ flex: 1 }}
              onPress={() => go(-1)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الشريحة التالية"
              style={{ flex: 1 }}
              onPress={() => go(1)}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          {msg ? (
            <AppText variant="caption" center color="#FCA5A5">
              {msg}
            </AppText>
          ) : null}
          <Button
            title={
              captureSupported
                ? "شارك هذه الشريحة"
                : "المشاركة متاحة في تطبيق الجوال"
            }
            size="lg"
            icon="share-social-outline"
            loading={busy}
            disabled={!captureSupported}
            onPress={share}
          />
        </View>
      </View>
    </View>
  );
}
