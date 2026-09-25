/** الويب: لا بصمة؛ القفل متاح في تطبيق الجوال. */
export const lockAvailable = async (): Promise<boolean> => false;
export const unlock = async (): Promise<boolean> => true;
export { shouldRelock, RELOCK_AFTER_MS } from './lockPolicy';
