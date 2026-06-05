import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTeams } from '../../hooks/useTeams';
import { useMatches } from '../../hooks/useMatches';
import { useCountry } from '../../hooks/useCountry';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { Match, SportType } from '../../constants/matches';
import { MatchGroup } from '../../services/matchService';

// ─── Color palette ────────────────────────────────────────────────────────────

const C = {
  bg0: '#060C1A',
  bg1: '#0A1628',
  bg2: '#0F2040',
  bg3: '#152B52',
  accent: '#4F8EF7',
  accentGlow: 'rgba(79,142,247,0.18)',
  text: '#F0F4FF',
  textSub: '#7B9CC4',
  textMuted: '#3D5A80',
  border: '#1A3560',
  sportFootball:   '#10B981',
  sportBasketball: '#F59E0B',
  sportVolleyball: '#4F8EF7',
  sportMotor:      '#EF4444',
};

// ─── Sport tabs ───────────────────────────────────────────────────────────────

type SportTab = { id: SportType | 'all'; label: string; color: string };

const SPORT_TABS: SportTab[] = [
  { id: 'all',         label: 'Tümü',     color: C.text },
  { id: 'football',   label: '⚽ Futbol',  color: C.sportFootball },
  { id: 'basketball', label: '🏀 Basket', color: C.sportBasketball },
  { id: 'volleyball', label: '🏐 Voley',  color: C.sportVolleyball },
  { id: 'motorsport', label: '🏎️ F1',      color: C.sportMotor },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { t } = useTranslation();
  const { selectedTeamIds } = useTeams();
  const { countryCode } = useCountry();
  const [activeSport, setActiveSport] = useState<SportType | 'all'>('all');

  const {
    filter,
    setFilter,
    matchGroups,
    hasMatches,
    isRefreshing,
    lastUpdated,
    refresh,
  } = useMatches(selectedTeamIds, countryCode, activeSport);

  const renderMatchItem = useCallback(
    ({ item }: { item: Match }) => <MatchCard match={item} />,
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: MatchGroup & { data: Match[] } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionLine} />
        <View style={styles.matchCountBadge}>
          <Text style={styles.matchCount}>{section.matches.length}</Text>
        </View>
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: Match) => item.id, []);
  const sections = matchGroups.map((g) => ({ ...g, data: g.matches }));

  const lastUpdateStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />

      {/* Header — deep navy */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Hangi Kanalda?</Text>
            {lastUpdateStr && (
              <Text style={styles.headerSub}>Son güncelleme: {lastUpdateStr}</Text>
            )}
          </View>
          {isRefreshing && (
            <ActivityIndicator size="small" color={C.accent} style={styles.spinner} />
          )}
        </View>

        {/* Sport filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
          style={styles.pillsScroll}
        >
          {SPORT_TABS.map((tab) => {
            const isActive = activeSport === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.pill,
                  isActive && { backgroundColor: tab.color + '22', borderColor: tab.color },
                ]}
                onPress={() => setActiveSport(tab.id)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.pillText,
                  isActive && { color: tab.color, fontWeight: '700' },
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* All / Favorites toggle */}
        <View style={styles.toggleRow}>
          <Toggle
            label={t('matches.allMatches')}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
            color={C.accent}
          />
          <Toggle
            label={t('matches.favoriteMatches')}
            active={filter === 'favorites'}
            onPress={() => setFilter('favorites')}
            color={C.accent}
          />
        </View>
      </View>

      {/* Content */}
      {!hasMatches ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            emoji={filter === 'favorites' ? '❤️' : '📅'}
            title={
              filter === 'favorites'
                ? t('matches.noFavoriteMatches')
                : t('matches.noMatches')
            }
            subtitle={
              filter === 'favorites' ? t('teams.infoText') : undefined
            }
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderMatchItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={C.accent}
              colors={[C.accent]}
              progressBackgroundColor={C.bg1}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function Toggle({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toggleBtn,
        active && { backgroundColor: color + '1A', borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.toggleBtnText, active && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg0,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  headerTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  spinner: {
    marginLeft: 8,
  },
  pillsScroll: {
    maxHeight: 44,
  },
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
    borderColor: C.border,
  },
  pillText: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: C.bg3,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleBtnText: {
    color: C.textMuted,
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
    backgroundColor: C.bg0,
  },
  sectionTitle: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  matchCountBadge: {
    backgroundColor: C.bg3,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  matchCount: {
    color: C.textSub,
    fontSize: 10,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 32,
  },
  emptyWrapper: {
    flex: 1,
    backgroundColor: C.bg0,
  },
});
