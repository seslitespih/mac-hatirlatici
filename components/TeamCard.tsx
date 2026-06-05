import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Team } from '../constants/teams';
import { useTranslation } from 'react-i18next';

interface Props {
  team: Team;
  isSelected: boolean;
  onToggle: (teamId: string) => void;
}

export default function TeamCard({ team, isSelected, onToggle }: Props) {
  const { i18n } = useTranslation();
  const localName = team.nameLocal[i18n.language] || team.name;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={() => onToggle(team.id)}
      activeOpacity={0.8}
    >
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: isSelected ? team.color : '#2a2a2a' }]} />
        <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
          {localName}
        </Text>
      </View>
      <View style={[styles.checkbox, isSelected ? styles.checkboxOn : styles.checkboxOff]}>
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
    borderBottomColor: '#181818',
  },
  selectedCard: {
    backgroundColor: '#141414',
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
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  nameSelected: {
    color: '#e8e8e8',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxOn: {
    backgroundColor: '#4ade80',
  },
  checkboxOff: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
});
