/** نسخة الويب: الاشتراك عبر المتاجر غير متاح، ويُستخدم الدفع التجريبي. */
import type { PlanId } from './payments';

export const ENTITLEMENT_ID = 'pro';
export const storeBillingEnabled = false;
export type StoreStatus = { active: boolean; until: number | null; plan: PlanId | null; willRenew: boolean };
export type StorePackages = Partial<Record<PlanId, { product: { priceString: string } }>>;
export type StoreResult = { ok: true; status: StoreStatus } | { ok: false; cancelled: boolean; message: string };

export const initPurchases = (_onStatus: (s: StoreStatus) => void): (() => void) => () => {};
export const loadStorePackages = async (): Promise<StorePackages> => ({});
export const buyPackage = async (_pkg: unknown): Promise<StoreResult> => ({ ok: false, cancelled: false, message: 'غير متاح على الويب' });
export const restorePurchases = async (): Promise<StoreResult> => ({ ok: false, cancelled: false, message: 'غير متاح على الويب' });
export const manageSubscription = async (): Promise<void> => {};
