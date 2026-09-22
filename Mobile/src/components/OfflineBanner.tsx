import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OfflineBannerProps {
  isOffline: boolean;
  pendingCount?: number;
}

export function OfflineBanner({ isOffline, pendingCount = 0 }: OfflineBannerProps) {
  if (!isOffline && pendingCount === 0) return null;

  return (
    <View style={[styles.container, isOffline ? styles.offlineBg : styles.syncingBg]}>
      <Text style={styles.text}>
        {isOffline 
          ? `● MOD OFFLINE — ${pendingCount} acțiuni salvate local (se vor sincroniza automat)`
          : `↻ Sincronizare în curs... (${pendingCount} în așteptare)`
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBg: {
    backgroundColor: '#b45309', // Amber-700
  },
  syncingBg: {
    backgroundColor: '#0284c7', // Sky-600
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
