import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Team } from '../constants/teams';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  team: Team;
  isSelected: boolean;
  onToggle: (teamId: string) => void;
}

export default function TeamCard({ team, isSelected, onToggle }: Props) {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const localName = team.nameLocal[i18n.language] || team.name;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderBottomColor: colors.border },
        isSelected && { backgroundColor: colors.bg3 },
      ]}
      onPress={() => onToggle(team.id)}
      activeOpacity={0.8}
    >
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: isSelected ? team.color : colors.border }]} />
        <Text
          style={[styles.name, { color: colors.textMuted }, isSelected && { color: colors.text }]}
          numberOfLines={1}
        >
          {localName}
        </Text>
      </View>
      <View style={[
        styles.checkbox,
        isSelected
          ? { backgroundColor: colors.success }
          : { borderWidth: 1, borderColor: colors.border },
      ]}>
        {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
