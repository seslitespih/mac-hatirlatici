import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Match } from '../constants/matches';
import { toggleReminder, isReminderSet } from '../services/notificationService';
import { translateTeamName } from '../constants/teamTranslations';
import { formatLocalTime, getDeviceTimezone } from '../utils/timezone';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  match: Match;
  onPress?: (match: Match) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MatchCard({ match, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const isLive  = match.status === 'live';
  const isF1    = match.sport === 'motorsport';
  const lang    = i18n.language;
  const homeName = translateTeamName(match.homeTeamName, lang);
  const awayName = translateTeamName(match.awayTeamName, lang);

  const SPORT_BORDER: Record<string, string> = {
    football:   colors.sportFootball,
    basketball: colors.sportBasketball,
    volleyball: colors.sportVolleyball,
    motorsport: colors.sportMotor,
  };

  const accent = SPORT_BORDER[match.sport] ?? colors.sportFootball;

  const now       = new Date();
  const matchDate = new Date(match.date);
  const diffMin   = Math.floor((matchDate.getTime() - now.getTime()) / 60000);
  const showSoon  = diffMin > 0 && diffMin <= 60;
  const isPast    = diffMin < -10;

  // Cihazın gerçek timezone'una göre saat göster (dil seçimi ≠ saat dilimi)
  const displayTime = formatLocalTime(new Date(match.date), getDeviceTimezone());

  const [reminderActive, setReminderActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    isReminderSet(match.id).then(setReminderActive);
  }, [match.id]);

  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulseAnim]);

  async function handleReminder() {
    if (isPast) return;
    const result = await toggleReminder(match, i18n.language);
    if (result === 'set') {
      setReminderActive(true);
    } else if (result === 'cancelled') {
      setReminderActive(false);
    } else if (result === 'failed') {
      // İzin yoksa iOS Ayarları'nı aç
      Linking.openSettings();
    }
  }

  const cardBg     = isLive ? colors.liveGlow : reminderActive ? colors.accentGlow : 'transparent';
  const borderColor = isLive ? colors.live : accent;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: borderColor, backgroundColor: colors.bg1 },
        (isLive || reminderActive) && {
          shadowColor: isLive ? colors.live : colors.accent,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        },
      ]}
      onPress={() => onPress?.(match)}
      activeOpacity={0.8}
    >
      <View style={[styles.glowStrip, { backgroundColor: cardBg }]} />

      {/* Top row: league + LIVE / soon badge + bell */}
      <View style={styles.topRow}>
        <Text style={[styles.league, { color: colors.textMuted }]} numberOfLines={1}>
          {match.league}
        </Text>
        <View style={styles.badges}>
          {isLive && (
            <View style={[styles.liveBadge, { backgroundColor: colors.liveGlow, borderColor: 'rgba(239,68,68,0.3)' }]}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim, backgroundColor: colors.live }]} />
              <Text style={[styles.liveTxt, { color: colors.live }]}>LIVE</Text>
            </View>
          )}
          {showSoon && !isLive && (
            <View style={[styles.soonBadge, { borderColor: accent }]}>
              <Text style={[styles.soonTxt, { color: accent }]}>{diffMin}m</Text>
            </View>
          )}
          {!isPast && !isLive && (
            <TouchableOpacity
              style={[
                styles.bellBtn,
                { borderColor: 'transparent' },
                reminderActive && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
              ]}
              onPress={handleReminder}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.bellIcon}>{reminderActive ? '🔔' : '🔕'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Teams row / F1 race */}
      {isF1 ? (
        <View style={styles.f1Block}>
          <Text style={[styles.f1Race,    { color: colors.text    }]} numberOfLines={1}>{homeName}</Text>
          <Text style={[styles.f1Circuit, { color: colors.textSub }]} numberOfLines={1}>{awayName}</Text>
        </View>
      ) : (
        <View style={styles.teamsRow}>
          <Text style={[styles.team, { color: colors.text }]} numberOfLines={2}>{homeName}</Text>
          <View style={[styles.timeContainer, { backgroundColor: colors.bg3 }]}>
            <Text style={[styles.time, { color: isLive ? colors.live : colors.accent }]}>
              {displayTime}
            </Text>
          </View>
          <Text style={[styles.team, styles.teamRight, { color: colors.text }]} numberOfLines={2}>
            {awayName}
          </Text>
        </View>
      )}

      {/* Channel pill(s) */}
      <View style={styles.channelRow}>
        {(match.channels && match.channels.length > 0) || match.channel ? (
          (match.channels && match.channels.length > 0
            ? match.channels
            : [match.channel]
          ).map((ch, i) => (
            <View key={i} style={[styles.channelPill, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
              {i === 0 && <Text style={styles.channelIcon}>📺</Text>}
              <Text style={[styles.channelTxt, { color: colors.textSub }]} numberOfLines={1}>{ch}</Text>
            </View>
          ))
        ) : (
          <View style={[styles.channelPill, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
            <Text style={styles.channelIcon}>📺</Text>
            <Text style={[styles.channelTxt, { color: colors.textMuted }]}>{t('matches.noChannel')}</Text>
          </View>
        )}
      </View>

      {/* Reminder active note */}
      {reminderActive && (
        <Text style={[styles.reminderNote, { color: colors.accent }]}>
          🔔 {displayTime} — {t('matches.reminder15min')}{' '}
          <Text style={[styles.reminderDisc, { color: colors.textMuted }]}>
            {t('matches.reminderNoGoal')}
          </Text>
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginVertical: 5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  glowStrip: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  league: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveTxt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  soonBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  soonTxt: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bellBtn: {
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderWidth: 1,
  },
  bellIcon: {
    fontSize: 15,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  team: {
    flex: 2,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 19,
  },
  teamRight: {
    textAlign: 'right',
  },
  timeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  time: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  f1Block: {
    gap: 4,
    marginBottom: 2,
  },
  f1Race: {
    fontSize: 15,
    fontWeight: '700',
  },
  f1Circuit: {
    fontSize: 12,
    fontWeight: '500',
  },
  channelRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    gap: 5,
  },
  channelIcon: {
    fontSize: 11,
  },
  channelTxt: {
    fontSize: 11,
    fontWeight: '600',
  },
  reminderNote: {
    marginTop: 8,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  reminderDisc: {
    fontSize: 10,
  },
});
