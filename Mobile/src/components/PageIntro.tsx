import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { TUTORIALS, TutorialSectionId, t, UserRole } from '@solar/shared';

interface PageIntroProps {
  sectionId: TutorialSectionId;
  locale?: 'ro' | 'en';
  /** When provided, only role notes for this role are shown. */
  role?: UserRole;
}

/**
 * Reusable page/screen introduction (HIIEKO spec §9-§11).
 * Progressive disclosure: concise summary visible by default, expandable
 * "How it works" with purpose, steps, role guidance and important warnings.
 * All copy comes from shared translation keys — nothing is hardcoded.
 */
export function PageIntro({ sectionId, locale = 'ro', role }: PageIntroProps) {
  const [expanded, setExpanded] = useState(false);
  const content = TUTORIALS[sectionId];
  if (!content) return null;

  const visibleRoles = role
    ? content.roles.filter((r) => r.role === role)
    : content.roles;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t(content.titleKey, locale)}</Text>
      <Text style={styles.short}>{t(content.shortKey, locale)}</Text>

      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t(content.titleKey, locale)}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.toggleText}>
          {expanded ? `${t('general.close', locale)} ▴` : `${t('howItWorks', locale)} ▾`}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detail}>
          <Text style={styles.label}>{t('tutorial.whatFor', locale)}</Text>
          <Text style={styles.body}>{t(content.purposeKey, locale)}</Text>

          <Text style={styles.label}>{t('tutorial.whatToDo', locale)}</Text>
          {content.steps.map((key, i) => (
            <Text key={key} style={styles.step}>
              {i + 1}. {t(key, locale)}
            </Text>
          ))}

          {visibleRoles.length > 0 && (
            <>
              <Text style={styles.label}>{t('role.who', locale)}</Text>
              {visibleRoles.map((r) => (
                <Text key={r.noteKey} style={styles.roleNote}>
                  • {t(r.noteKey, locale)}
                </Text>
              ))}
            </>
          )}

          {content.importantKey ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>⚠ {t(content.importantKey, locale)}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '800',
  },
  short: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  toggleBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  toggleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  detail: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 8,
  },
  body: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 19,
  },
  step: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 20,
  },
  roleNote: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  warn: {
    backgroundColor: '#78350f',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  warnText: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
