/**
 * SettingsScreen — language picker + account logout.
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
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { Check, Globe2, LogOut, User } from 'lucide-react-native';
import { useLocale, t as translate, type Locale } from '@solar/shared';
import { useAuth } from '../contexts/AuthContext';

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
  const { currentUser, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = () => {
    Alert.alert(
      locale === 'ro' ? 'Deconectare' : 'Logout',
      locale === 'ro' ? 'Sigur doriți să vă deconectați?' : 'Are you sure you want to log out?',
      [
        {
          text: locale === 'ro' ? 'Anulare' : 'Cancel',
          style: 'cancel',
        },
        {
          text: locale === 'ro' ? 'Deconectare' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(
                locale === 'ro' ? 'Eroare' : 'Error',
                locale === 'ro' ? 'Nu s-a putut deconecta.' : 'Could not log out.'
              );
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="settings-screen">
      {/* User Info Section */}
      {currentUser && (
        <View style={[styles.section, styles.accountSection]}>
          <View style={styles.sectionHeader}>
            <User size={18} color="#f59e0b" />
            <Text style={styles.sectionTitle}>
              {locale === 'ro' ? 'Cont' : 'Account'}
            </Text>
          </View>
          
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {currentUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{currentUser.full_name}</Text>
              <Text style={styles.userEmail}>{currentUser.email}</Text>
              <Text style={styles.userRole}>
                {locale === 'ro' ? 'Rol: ' : 'Role: '}
                {formatRole(currentUser.role, locale)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <LogOut size={18} color="#ffffff" />
                <Text style={styles.logoutButtonText}>
                  {locale === 'ro' ? 'Deconectare' : 'Log Out'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Language Section */}
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

function formatRole(role: string, locale: Locale): string {
  const roleMap: Record<string, { ro: string; en: string }> = {
    admin: { ro: 'Administrator', en: 'Administrator' },
    manager: { ro: 'Manager', en: 'Manager' },
    team_leader: { ro: 'Șef Echipă', en: 'Team Leader' },
    worker: { ro: 'Muncitor', en: 'Worker' },
    owner: { ro: 'Proprietar', en: 'Owner' },
  };
  return roleMap[role]?.[locale] || role;
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
  accountSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  userRole: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  logoutButtonDisabled: {
    backgroundColor: '#991b1b',
    opacity: 0.7,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
