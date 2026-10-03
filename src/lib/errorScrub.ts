/**
 * تنقية بلاغات الأعطال (بلا اعتماد على الجهاز، لتُختبر): حذف ما قد يدل على شخص، وحدود الإرسال.
 */
export function scrubError(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/[^\s@]+@[^\s@]+/g, '[email]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[token]')
    .replace(/[0-9٠-٩]{4,}/g, '[n]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** مُبلّغ بحدود: كل خطأ مرة واحدة، و5 بلاغات كحد أقصى في الجلسة. */
export function createReporter(send: (screen: string, message: string) => Promise<void>, max = 5) {
  const seen = new Set<string>();
  return (error: unknown, screen = '') => {
    const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const message = scrubError(raw);
    const key = `${screen}|${message}`;
    if (!message || seen.has(key) || seen.size >= max) return false;
    seen.add(key);
    send(scrubError(screen).slice(0, 80), message).catch(() => {});
    return true;
  };
}
