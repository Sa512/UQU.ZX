import { useRef, useState } from "react";
import { PixelRatio, Platform, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import {
  Wallpaper,
  type WallContent,
  type WallTheme,
} from "@/components/Wallpaper";
import { captureSupported, saveWallpaper } from "@/lib/capture";
import { useStore } from "@/store/useStore";
import { spacing, useTheme } from "@/theme";

export default function WallpaperScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const slots = useStore((s) => s.slots);
  const courses = useStore((s) => s.courses);
  const sections = useStore((s) => s.sections);
  const settings = useStore((s) => s.settings);
  const isProf = settings.role === "professor";
  const [theme, setTheme] = useState<WallTheme>("violet");
  const [content, setContent] = useState<WallContent>("week");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const ref = useRef<View>(null);
  const previewW = Math.min(width - 2 * spacing.xl, 300);
  const title =
    content === "office"
      ? `ساعاتي المكتبية${settings.name ? ` · ${settings.name}` : ""}`
      : isProf
        ? `جدول ${settings.name || "المحاضرات"}`
        : "جدولي الأسبوعي";

  const save = async () => {
    setBusy(true);
    const r = await saveWallpaper(ref);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
  };

  // نسخة بالدقة الكاملة خلف الشاشة تُلتقط بدل المعاينة الصغيرة حتى لا تكون الصورة مشوشة
  const fullW = 1290 / PixelRatio.get();
  const props = { theme, content, slots, courses, sections, title };

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS !== "web" && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, zIndex: -1 }}
        >
          <Wallpaper ref={ref} width={fullW} {...props} />
        </View>
      )}
      <Screen
        back
        title="خلفية الجدول"
        subtitle="احفظ جدولك كخلفية لشاشة القفل"
        footer={
          <Button
            title={
              captureSupported ? "حفظ في الصور" : "الحفظ متاح في تطبيق الجوال"
            }
            size="lg"
            icon="download-outline"
            loading={busy}
            disabled={!captureSupported}
            onPress={save}
          />
        }
      >
        <Segmented<WallTheme>
          value={theme}
          onChange={setTheme}
          options={[
            { value: "violet", label: "بنفسجي" },
            { value: "midnight", label: "ليلي" },
            { value: "light", label: "فاتح" },
          ]}
        />
        {isProf && (
          <Segmented<WallContent>
            value={content}
            onChange={setContent}
            options={[
              { value: "week", label: "الجدول كامل" },
              { value: "office", label: "الساعات المكتبية" },
            ]}
          />
        )}
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 6,
              borderColor: "#0F172A",
            }}
          >
            <Wallpaper width={previewW} {...props} />
          </View>
        </View>
        <AppText variant="caption" muted center>
          تُحفظ الصورة بدقة 1290×2796، والمساحة العلوية فارغة لتظهر الساعة فوق
          جدولك.
        </AppText>
        {msg && (
          <AppText
            variant="label"
            center
            color={msg.ok ? colors.success : colors.danger}
          >
            {msg.text}
          </AppText>
        )}
      </Screen>
    </View>
  );
}
