import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTeams } from '../../hooks/useTeams';
import { useNotifications } from '../../hooks/useNotifications';
import TeamCard from '../../components/TeamCard';
import LeagueHeader from '../../components/LeagueHeader';
import EmptyState from '../../components/EmptyState';
import { Team } from '../../constants/teams';
import { useTheme } from '../../contexts/ThemeContext';

export default function TeamsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const {
    selectedTeamIds, selectedTeams, searchQuery, setSearchQuery,
    isLoading, toggleTeam, isSelected, teamsByLeague,
  } = useTeams();

  const { notificationsEnabled } = useNotifications(selectedTeamIds);

  const renderTeamItem = useCallback(
    ({ item }: { item: Team }) => (
      <TeamCard team={item} isSelected={isSelected(item.id)} onToggle={toggleTeam} />
    ),
    [isSelected, toggleTeam],
  );

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg0 }]}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('teams.title')}</Text>
        {selectedTeamIds.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.success }]}>
            <Text style={styles.badgeText}>{selectedTeamIds.length}</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('teams.search')}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Ionicons name="close-circle" size={16} color={colors.textMuted} onPress={() => setSearchQuery('')} />
        )}
      </View>

      {/* Selected teams chips */}
      {selectedTeams.length > 0 && !searchQuery && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          {selectedTeams.map((team) => (
            <View key={team.id} style={[styles.chip, { backgroundColor: colors.bg2, borderColor: colors.success }]}>
              <Text style={[styles.chipText, { color: colors.success }]}>
                {team.nameLocal[i18n.language] ?? team.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {teamsByLeague.length === 0 ? (
          <EmptyState emoji="🔍" title={t('teams.noTeams')} />
        ) : (
          teamsByLeague.map(({ league, teams }) => {
            const selCount = teams.filter((t) => selectedTeamIds.includes(t.id)).length;
            return (
              <LeagueHeader
                key={league.id}
                leagueId={league.id}
                leagueName={league.name}
                leagueEmoji={league.emoji}
                teamCount={teams.length}
                selectedCount={selCount}
              >
                <FlatList
                  data={teams}
                  keyExtractor={(item) => item.id}
                  renderItem={renderTeamItem}
                  scrollEnabled={false}
                />
              </LeagueHeader>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  badge: {
    borderRadius: 10,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: '#000', fontSize: 13, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chipsScroll: { maxHeight: 42, marginBottom: 6 },
  chips: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  list: { flex: 1 },
});
