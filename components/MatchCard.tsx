import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Match } from '../constants/matches';
import { toggleReminder, isReminderSet } from '../services/notificationService';

// ─── Color palette ────────────────────────────────────────────────────────────

const C = {
  bg0: '#060C1A',
  bg1: '#0A1628',
  bg2: '#0F2040',
  bg3: '#152B52',
  accent: '#4F8EF7',
  accentGlow: 'rgba(79,142,247,0.18)',
  purple: '#8B5CF6',
  live: '#EF4444',
  liveGlow: 'rgba(239,68,68,0.15)',
  text: '#F0F4FF',
  textSub: '#7B9CC4',
  textMuted: '#3D5A80',
  border: '#1A3560',
  sportFootball:   '#10B981',
  sportBasketball: '#F59E0B',
  sportVolleyball: '#4F8EF7',
  sportMotor:      '#EF4444',
};

const SPORT_BORDER: Record<string, string> = {
  football:   C.sportFootball,
  basketball: C.sportBasketball,
  volleyball: C.sportVolleyball,
  motorsport: C.sportMotor,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  match: Match;
  onPress?: (match: Match) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MatchCard({ match, onPress }: Props) {
  const { i18n } = useTranslation();

  const isLive  = match.status === 'live';
  const isF1    = match.sport === 'motorsport';
  const accent  = SPORT_BORDER[match.sport] ?? C.sportFootball;

  const now       = new Date();
  const matchDate = new Date(match.date);
  const diffMin   = Math.floor((matchDate.getTime() - now.getTime()) / 60000);
  const showSoon  = diffMin > 0 && diffMin <= 60;
  const isPast    = diffMin < -10;

  const [reminderActive, setReminderActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    isReminderSet(match.id).then(setReminderActive);
  }, [match.id]);

  // Pulsing dot animation for LIVE badge
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
    }
    // 'failed' — silent, user can try again
  }

  const cardBg = isLive ? C.liveGlow : reminderActive ? C.accentGlow : 'transparent';
  const borderColor = isLive ? C.live : accent;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: borderColor, backgroundColor: C.bg1 },
        (isLive || reminderActive) && {
          shadowColor: isLive ? C.live : C.accent,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        },
      ]}
      onPress={() => onPress?.(match)}
      activeOpacity={0.8}
    >
      {/* Colored top-left glow strip */}
      <View style={[styles.glowStrip, { backgroundColor: cardBg }]} />

      {/* Top row: league + LIVE / soon badge + bell */}
      <View style={styles.topRow}>
        <Text style={styles.league} numberOfLines={1}>{match.league}</Text>
        <View style={styles.badges}>
          {isLive && (
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveTxt}>LIVE</Text>
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
                reminderActive && { backgroundColor: C.accentGlow, borderColor: C.accent },
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
          <Text style={styles.f1Race}    numberOfLines={1}>{match.homeTeamName}</Text>
          <Text style={styles.f1Circuit} numberOfLines={1}>{match.awayTeamName}</Text>
        </View>
      ) : (
        <View style={styles.teamsRow}>
          <Text style={styles.team} numberOfLines={2}>{match.homeTeamName}</Text>
          <View style={styles.timeContainer}>
            <Text style={[styles.time, { color: isLive ? C.live : C.accent }]}>
              {match.time}
            </Text>
          </View>
          <Text style={[styles.team, styles.teamRight]} numberOfLines={2}>
            {match.awayTeamName}
          </Text>
        </View>
      )}

      {/* Channel pill(s) — hangikanalda.app birden fazla kanal verebilir */}
      {(match.channels && match.channels.length > 0) || match.channel ? (
        <View style={styles.channelRow}>
          {(match.channels && match.channels.length > 0
            ? match.channels
            : [match.channel]
          ).map((ch, i) => (
            <View key={i} style={styles.channelPill}>
              {i === 0 && <Text style={styles.channelIcon}>📺</Text>}
              <Text style={styles.channelTxt} numberOfLines={1}>{ch}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Reminder active note */}
      {reminderActive && (
        <Text style={styles.reminderNote}>
          🔔 {match.time} — 15 dk önce hatırlatılacak{' '}
          <Text style={styles.reminderDisc}>(Sadece maç saati — gol bildirimi verilmez)</Text>
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
    color: C.textMuted,
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
    backgroundColor: C.liveGlow,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.live,
  },
  liveTxt: {
    color: C.live,
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
    borderColor: 'transparent',
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
    color: C.text,
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
    backgroundColor: C.bg3,
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
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
  },
  f1Circuit: {
    color: C.textSub,
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
    backgroundColor: C.bg3,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.border,
    gap: 5,
  },
  channelIcon: {
    fontSize: 11,
  },
  channelTxt: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '600',
  },
  reminderNote: {
    marginTop: 8,
    fontSize: 10,
    color: C.accent,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  reminderDisc: {
    color: C.textMuted,
    fontSize: 10,
  },
});
