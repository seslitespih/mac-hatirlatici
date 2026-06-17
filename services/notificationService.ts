/**
 * notificationService.ts
 * Maç hatırlatıcıları — 15 dk önce bildirim.
 * Bildirim metni kullanıcı diline göre otomatik seçilir.
 * "Sadece maç saati — gol bildirimi yok" notu her dilde parantez içinde eklenir.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match } from '../constants/matches';
import { formatLocalTime, getDeviceTimezone } from '../utils/timezone';

const REMINDERS_KEY         = 'match_reminders';
const REMIND_BEFORE_MINUTES = 15;

// ─── Çok dilli bildirim metinleri ────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  football:   '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  motorsport: '🏎️',
};

interface LangStrings {
  minsLeft: string;   // "15 dk kaldı" equivalent
  on: string;         // "on" / "da" / "sur" (channel preposition)
  note: string;       // parenthetical disclaimer
}

const LANG_STRINGS: Record<string, LangStrings> = {
  tr: {
    minsLeft: `${REMIND_BEFORE_MINUTES} dk kaldı`,
    on: '',
    note: '(Sadece maç saati hatırlatıcısı. Gol bildirimi verilmez.)',
  },
  en: {
    minsLeft: `${REMIND_BEFORE_MINUTES} min to kickoff`,
    on: 'on',
    note: '(Match time reminder only. No goal alerts.)',
  },
  es: {
    minsLeft: `comienza en ${REMIND_BEFORE_MINUTES} min`,
    on: 'en',
    note: '(Solo recordatorio de hora. Sin alertas de goles.)',
  },
  pt: {
    minsLeft: `começa em ${REMIND_BEFORE_MINUTES} min`,
    on: 'na',
    note: '(Apenas lembrete de horário. Sem alertas de gol.)',
  },
  fr: {
    minsLeft: `dans ${REMIND_BEFORE_MINUTES} min`,
    on: 'sur',
    note: "(Rappel d'heure uniquement. Pas d'alertes de but.)",
  },
  de: {
    minsLeft: `in ${REMIND_BEFORE_MINUTES} Min`,
    on: 'auf',
    note: '(Nur Spielzeit-Erinnerung. Keine Tor-Benachrichtigungen.)',
  },
  it: {
    minsLeft: `tra ${REMIND_BEFORE_MINUTES} minuti`,
    on: 'su',
    note: '(Solo promemoria orario. Nessun avviso gol.)',
  },
  ar: {
    minsLeft: `يبدأ بعد ${REMIND_BEFORE_MINUTES} دقيقة`,
    on: 'على',
    note: '(تذكير بموعد المباراة فقط. لا إشعارات أهداف.)',
  },
};

function getStrings(lang: string): LangStrings {
  return LANG_STRINGS[lang] ?? LANG_STRINGS['en'];
}

function buildNotificationContent(match: Match, lang = 'tr') {
  const emoji  = SPORT_EMOJI[match.sport] ?? '🏆';
  const isF1   = match.sport === 'motorsport';
  const s      = getStrings(lang);

  const title = isF1
    ? `${emoji} ${match.homeTeamName} – ${s.minsLeft}!`
    : `${emoji} ${match.homeTeamName} vs ${match.awayTeamName} – ${s.minsLeft}!`;

  const channelLine = match.channel
    ? `📺 ${s.on ? s.on + ' ' : ''}${match.channel}`
    : '';

  const localTime = formatLocalTime(new Date(match.date), getDeviceTimezone());
  const body = [
    `🕐 ${localTime} | ${match.league}`,
    channelLine,
    s.note,
  ].filter(Boolean).join('\n');

  return { title, body };
}

// ─── İzin ────────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Alias — _layout.tsx ve useNotifications.ts bu isimle import ediyor
export async function requestNotificationPermissions(): Promise<boolean> {
  return requestNotificationPermission();
}

// ─── Depolama ────────────────────────────────────────────────────────────────

async function getReminders(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(REMINDERS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveReminders(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(map));
}

export async function isReminderSet(matchId: string): Promise<boolean> {
  const map = await getReminders();
  return matchId in map;
}

// ─── Tekil hatırlatıcı kur / kaldır ─────────────────────────────────────────

export async function setReminder(match: Match, lang = 'tr'): Promise<boolean> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return false;

  const fireDate = new Date(new Date(match.date).getTime() - REMIND_BEFORE_MINUTES * 60 * 1000);
  if (fireDate <= new Date()) return false;

  const { title, body } = buildNotificationContent(match, lang);

  const notifId = await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
    },
  });

  const map = await getReminders();
  map[match.id] = notifId;
  await saveReminders(map);
  return true;
}

export async function cancelReminder(matchId: string): Promise<void> {
  const map = await getReminders();
  const notifId = map[matchId];
  if (notifId) {
    await Notifications.cancelScheduledNotificationAsync(notifId);
    delete map[matchId];
    await saveReminders(map);
  }
}

export async function toggleReminder(match: Match, lang = 'tr'): Promise<'set' | 'cancelled' | 'failed'> {
  const already = await isReminderSet(match.id);
  if (already) {
    await cancelReminder(match.id);
    return 'cancelled';
  }
  const ok = await setReminder(match, lang);
  return ok ? 'set' : 'failed';
}

// ─── Toplu bildirim yönetimi (useNotifications.ts ihtiyacı) ─────────────────

/**
 * Seçili takımların gelecek maçları için bildirim zamanlar.
 * Önceki tüm bildirimleri siler, yeniden zamanlar.
 */
export async function scheduleAllNotifications(
  selectedTeamIds: string[],
  matches: Match[],
  lang = 'tr',
): Promise<void> {
  await cancelAllNotifications();

  if (selectedTeamIds.length === 0) return;

  const now = new Date();
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const newMap: Record<string, string> = {};

  for (const match of matches) {
    const isSelected =
      selectedTeamIds.includes(match.homeTeam) ||
      selectedTeamIds.includes(match.awayTeam);
    if (!isSelected) continue;

    const fireDate = new Date(new Date(match.date).getTime() - REMIND_BEFORE_MINUTES * 60 * 1000);
    if (fireDate <= now) continue;

    const { title, body } = buildNotificationContent(match, lang);
    const notifId = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
    newMap[match.id] = notifId;
  }

  await saveReminders(newMap);
}

/**
 * Tüm zamanlanmış bildirimleri iptal eder.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(REMINDERS_KEY);
}

// ─── Uygulama başlangıç yapılandırması ──────────────────────────────────────

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });
}
