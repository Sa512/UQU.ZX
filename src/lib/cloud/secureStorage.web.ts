/** على الويب لا توجد خزنة مشفّرة؛ يبقى تخزين المتصفح (للنموذج التجريبي). */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const secureStorage = AsyncStorage;
