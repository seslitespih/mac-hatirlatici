import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  leagueId: string;
  leagueName: string;
  leagueEmoji: string;
  teamCount: number;
  selectedCount: number;
  children: React.ReactNode;
}

export default function LeagueHeader({
  leagueId, leagueName, leagueEmoji, teamCount, selectedCount, children,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const localName = t(`teams.leagues.${leagueId}`, { defaultValue: leagueName });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.bg2, borderBottomColor: colors.border }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.left}>
          <Text style={[styles.name, { color: colors.textMuted }]}>{localName}</Text>
          {selectedCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.success }]}>
              <Text style={styles.badgeText}>{selectedCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.right}>
          <Text style={[styles.count, { color: colors.textMuted }]}>{teamCount}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
      {expanded && <View>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  name: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  count: { fontSize: 11 },
});
