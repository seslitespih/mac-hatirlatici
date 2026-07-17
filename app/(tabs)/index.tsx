import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useTeams } from '../../hooks/useTeams';
import { useMatches } from '../../hooks/useMatches';
import { useCountry } from '../../contexts/CountryContext';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { Match, SportType } from '../../constants/matches';
import { MatchGroup } from '../../services/matchService';

type SportTab = { id: SportType | 'all'; label: string; color: string };

export default function MatchesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedTeamIds, reloadSelectedTeams } = useTeams();
  const { countryCode, isLoading: countryLoading } = useCountry();
  const [activeSport, setActiveSport] = useState<SportType | 'all'>('football');
  const {
    filter,
    setFilter,
    matchGroups,
    hasMatches,
    isRefreshing,
    lastUpdated,
    refresh,
  } = useMatches(selectedTeamIds, countryCode, activeSport, !countryLoading);

  // useFocusEffect yerine useEffect: expo-router'ın navigation state'ine bağımlılığı kaldırır.
  // Takımlar mount'ta ve selectedTeamIds değişince yeniden yüklenir.
  useEffect(() => {
    reloadSelectedTeams();
  }, [reloadSelectedTeams]);

  const sportTabs: SportTab[] = [
    { id: 'all',         label: t('matches.sports.all'),                         color: colors.text },
    { id: 'football',   label: `⚽ ${t('matches.sports.football')}`,              color: colors.sportFootball },
    { id: 'basketball', label: `🏀 ${t('matches.sports.basketball')}`,            color: colors.sportBasketball },
    { id: 'volleyball', label: `🏐 ${t('matches.sports.volleyball')}`,            color: colors.sportVolleyball },
    { id: 'motorsport', label: `🏎️ ${t('matches.sports.motorsport')}`,             color: colors.sportMotor },
  ];

  const renderMatchItem = useCallback(
    ({ item }: { item: Match }) => <MatchCard match={item} />,
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: MatchGroup & { data: Match[] } }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.bg0 }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
        <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
        <View style={[styles.matchCountBadge, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
          <Text style={[styles.matchCount, { color: colors.textSub }]}>{section.matches.length}</Text>
        </View>
      </View>
    ),
    [colors],
  );

  const keyExtractor = useCallback((item: Match) => item.id, []);
  const sections = matchGroups.map((g) => ({ ...g, data: g.matches }));

  const lastUpdateStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg0} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg1, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Match Reminder
            </Text>
            {lastUpdateStr && (
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                {t('matches.lastUpdated', { time: lastUpdateStr })}
              </Text>
            )}
          </View>
          {isRefreshing && (
            <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} />
          )}
        </View>

        {/* Sport filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
          style={styles.pillsScroll}
        >
          {sportTabs.map((tab) => {
            const isActive = activeSport === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.pill,
                  { borderColor: colors.border },
                  isActive && { backgroundColor: tab.color + '22', borderColor: tab.color },
                ]}
                onPress={() => setActiveSport(tab.id)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.pillText,
                  { color: colors.textMuted },
                  isActive && { color: tab.color, fontWeight: '700' },
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

      </View>

      {/* Content */}
      {!hasMatches ? (
        <View style={[styles.emptyWrapper, { backgroundColor: colors.bg0 }]}>
          <EmptyState
            emoji={filter === 'favorites' ? '❤️' : '📅'}
            title={filter === 'favorites' ? t('matches.noFavoriteMatches') : t('matches.noMatches')}
            subtitle={filter === 'favorites' ? t('teams.infoText') : undefined}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderMatchItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[styles.list, { backgroundColor: colors.bg0 }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          ListHeaderComponent={null}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.bg1}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function Toggle({
  label, active, onPress, color, inactiveColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
  inactiveColor: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toggleBtn,
        { borderColor: 'transparent' },
        active && { backgroundColor: color + '1A', borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.toggleBtnText, { color: inactiveColor }, active && { color }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  spinner: { marginLeft: 8 },
  pillsScroll: { maxHeight: 44 },
  pillsContainer: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  matchCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  matchCount: {
    fontSize: 10,
    fontWeight: '700',
  },
  list: { paddingBottom: 32 },
  emptyWrapper: { flex: 1 },
});
