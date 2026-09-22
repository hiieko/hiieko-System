/**
 * SettingsScreen — language picker.
 *
 * This screen was added to fulfil the HIIEKO language-switcher requirement.
 * It uses the **shared** translation system (no second i18n here): labels
 * come from `t('settings.*')` keys defined in `shared/src/translations.ts`,
 * and the selected locale is read/written through `<LocaleContext>` so the
 * rest of the app re-renders in the new language immediately.
 *
 * Persistence happens inside the context's `setLocale` (AsyncStorage key
 * `@solar:locale`). After process restart the LocaleProvider rehydrates
 * from there, so the user's choice is stable across launches.
 *
 * The screen deliberately does NOT introduce new i18n machinery, locale
 * prop chains, or hardcoded UI strings — both were requirements of the
 * task definition.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Check, Globe2 } from 'lucide-react-native';
import { useLocale, t as translate, type Locale } from '@solar/shared';

interface LangOption {
  value: Locale;
  labelKey: string;
  subKey: string;
  flag: string;
}

const LANG_OPTIONS: LangOption[] = [
  {
    value: 'ro',
    labelKey: 'settings.option.ro.label',
    subKey: 'settings.option.ro.sub',
    flag: '🇷🇴',
  },
  {
    value: 'en',
    labelKey: 'settings.option.en.label',
    subKey: 'settings.option.en.sub',
    flag: '🇬🇧',
  },
];

export function SettingsScreen() {
  const { locale, setLocale } = useLocale();

  return (
    <ScrollView contentContainerStyle={styles.container} testID="settings-screen">
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Globe2 size={18} color="#f59e0b" />
          <Text style={styles.sectionTitle}>
            {translate('settings.section_title', locale)}
          </Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          {translate('settings.section_subtitle', locale)}
        </Text>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={translate('settings.ar_label', locale)}
          style={styles.list}
        >
          {LANG_OPTIONS.map((opt, idx) => {
            const selected = opt.value === locale;
            return (
              <TouchableOpacity
                key={opt.value}
                testID={`locale-option-${opt.value}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={translate(opt.labelKey, locale)}
                onPress={() => setLocale(opt.value)}
                style={[
                  styles.optionRow,
                  idx === LANG_OPTIONS.length - 1 && styles.optionRowLast,
                  selected && styles.optionRowSelected,
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>{opt.flag}</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{translate(opt.labelKey, locale)}</Text>
                  <Text style={styles.optionSub}>{translate(opt.subKey, locale)}</Text>
                </View>
                {selected ? <Check size={20} color="#f59e0b" /> : <View style={styles.placeholder} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footnote}>
        <Text style={styles.footnoteText}>
          {translate('settings.saved_hint', locale)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#0f172a',
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  list: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#1e293b',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1e293b',
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionRowSelected: {
    backgroundColor: '#172554',
  },
  flag: {
    fontSize: 22,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  optionSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  placeholder: {
    width: 20,
    height: 20,
  },
  footnote: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  footnoteText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
});
