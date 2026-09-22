/**
 * الاشتراك عبر متجري Apple وGoogle (In‑App Purchase / Play Billing) باستخدام RevenueCat.
 *
 * يتفعّل تلقائياً عند وضع مفاتيح RevenueCat في متغيرات البيئة:
 *   EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
 * وبدونها يعمل التطبيق بالبوابة التجريبية (Sandbox) في `payments.ts`.
 *
 * إعداد RevenueCat المطلوب: Entitlement باسم `pro`، وعرض (Offering) حالي فيه الحزم
 * $rc_monthly و $rc_six_month و $rc_annual.
 */
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import type { PlanId } from './payments';

export const ENTITLEMENT_ID = 'pro';

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

/** true عندما يكون الدفع الحقيقي عبر المتجر مفعّلاً. */
export const storeBillingEnabled = !!API_KEY && (Platform.OS === 'ios' || Platform.OS === 'android');

const PACKAGE_TO_PLAN: Record<string, PlanId> = {
  $rc_monthly: 'monthly',
  $rc_six_month: 'term',
  $rc_annual: 'yearly',
};

export type StoreStatus = { active: boolean; until: number | null; plan: PlanId | null; willRenew: boolean };

export function statusFromInfo(info: CustomerInfo): StoreStatus {
  const ent = info.entitlements.active[ENTITLEMENT_ID];
  if (!ent) return { active: false, until: null, plan: null, willRenew: false };
  const id = ent.productIdentifier.toLowerCase();
  const plan: PlanId = id.includes('year') || id.includes('annual') ? 'yearly' : id.includes('six') || id.includes('6') || id.includes('term') ? 'term' : 'monthly';
  return { active: true, until: ent.expirationDateMillis ?? null, plan, willRenew: ent.willRenew };
}

let configured = false;

export function initPurchases(onStatus: (s: StoreStatus) => void): () => void {
  if (!storeBillingEnabled || !API_KEY) return () => {};
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  }
  const listener = (info: CustomerInfo) => onStatus(statusFromInfo(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  Purchases.getCustomerInfo().then(listener).catch(() => {});
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export type StorePackages = Partial<Record<PlanId, PurchasesPackage>>;

export async function loadStorePackages(): Promise<StorePackages> {
  const offerings = await Purchases.getOfferings();
  const out: StorePackages = {};
  for (const p of offerings.current?.availablePackages ?? []) {
    const plan = PACKAGE_TO_PLAN[p.identifier];
    if (plan) out[plan] = p;
  }
  return out;
}

export type StoreResult = { ok: true; status: StoreStatus } | { ok: false; cancelled: boolean; message: string };

const errorMessage = (e: unknown) =>
  (e as { userCancelled?: boolean })?.userCancelled
    ? { ok: false as const, cancelled: true, message: '' }
    : { ok: false as const, cancelled: false, message: 'تعذّر إتمام العملية عبر المتجر. حاول مرة أخرى.' };

export async function buyPackage(pkg: PurchasesPackage): Promise<StoreResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, status: statusFromInfo(customerInfo) };
  } catch (e) {
    return errorMessage(e);
  }
}

export async function restorePurchases(): Promise<StoreResult> {
  try {
    return { ok: true, status: statusFromInfo(await Purchases.restorePurchases()) };
  } catch (e) {
    return errorMessage(e);
  }
}

export async function manageSubscription(): Promise<void> {
  await Purchases.showManageSubscriptions();
}
