import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  ScrollView, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTeams } from '../../hooks/useTeams';
import { useNotifications } from '../../hooks/useNotifications';
import TeamCard from '../../components/TeamCard';
import LeagueHeader from '../../components/LeagueHeader';
import EmptyState from '../../components/EmptyState';
import { Team } from '../../constants/teams';

export default function TeamsScreen() {
  const { t } = useTranslation();
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
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('teams.title')}</Text>
        {selectedTeamIds.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedTeamIds.length}</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#333" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('teams.search')}
          placeholderTextColor="#333"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Ionicons name="close-circle" size={16} color="#333" onPress={() => setSearchQuery('')} />
        )}
      </View>

      {/* Seçili takımlar */}
      {selectedTeams.length > 0 && !searchQuery && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          {selectedTeams.map((team) => (
            <View key={team.id} style={styles.chip}>
              <Text style={styles.chipText}>{team.name}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Liste */}
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
  safe:    { flex: 1, backgroundColor: '#0a0a0a' },
  loading: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: { color: '#f0f0f0', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  badge: {
    backgroundColor: '#4ade80',
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
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  searchInput: { flex: 1, color: '#e8e8e8', fontSize: 14, padding: 0 },
  chipsScroll: { maxHeight: 42, marginBottom: 6 },
  chips: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  chip: {
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  chipText: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  list: { flex: 1 },
});
