/** على الويب لا توجد خزنة مشفّرة: كلمة المرور تبقى في الذاكرة لهذه الجلسة فقط (لا نسخ تلقائي). */
const mem = new Map<string, string>();

export const canRememberPassword = false;

export async function rememberPassword(account: string, password: string) {
  mem.set(account, password);
}

export async function recallPassword(account: string): Promise<string | null> {
  return mem.get(account) ?? null;
}

export async function forgetPassword(account: string) {
  mem.delete(account);
}
