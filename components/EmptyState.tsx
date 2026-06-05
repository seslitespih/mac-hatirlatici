import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  emoji?: string;
  title: string;
  subtitle?: string;
}

export default function EmptyState({
  emoji = '⚽',
  title,
  subtitle,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a0aec0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
