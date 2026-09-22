import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY_NATIVE,
  parseLocale,
  type Locale,
} from '@solar/shared';

/**
 * Mobile-side bridge between `<LocaleContext>` and `@react-native-async-storage`.
 *
 * The Web provider uses `localStorage`. The Mobile provider cannot know in
 * advance whether `<LocaleProvider>` runs on Web or Mobile in a shared
 * codebase — so this small adapter isolates the AsyncStorage import. Web
 * imports `readPersistedLocale` / `writePersistedLocale` directly; Mobile
 * swaps them for the AsyncStorage versions.
 */

export async function readPersistedLocaleMobile(): Promise<Locale> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY_NATIVE);
    return parseLocale(raw);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function writePersistedLocaleMobile(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY_NATIVE, locale);
  } catch {
    // ignore (quota, locked storage)
  }
}
