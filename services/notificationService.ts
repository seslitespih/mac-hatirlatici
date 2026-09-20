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
import { pushKaydiniGuncelle } from './pushService';
import { getNotifySports, NotifySport } from './storageService';

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

// ─── Sabah özeti ─────────────────────────────────────────────────────────────
// Kullanıcı isteği (20 Eyl 2026): favori takımın o gün maçı varsa sabah bir kez
// haber ver; maçtan 15 dk önceki hatırlatma ayrıca devam etsin.
// Push aktifse bu bildirimi SUNUCU gönderir (uygulama açılmasa da gelir);
// buradaki kurulum push'un çalışmadığı cihazlar için yedektir.

const SUMMARY_HOUR  = 9;    // cihazın yerel saati
const SUMMARY_LINES = 3;    // bildirimde en fazla bu kadar maç; gerisi "+N"

interface SummaryStrings {
  one:  string;
  many: (n: number) => string;
  more: (k: number) => string;
}

const SUMMARY_STRINGS: Record<string, SummaryStrings> = {
  tr: { one: 'Bugün 1 maçın var',       many: (n) => `Bugün ${n} maçın var`,       more: (k) => `+${k} maç daha` },
  en: { one: '1 match today',           many: (n) => `${n} matches today`,         more: (k) => `+${k} more` },
  es: { one: 'Hoy tienes 1 partido',    many: (n) => `Hoy tienes ${n} partidos`,   more: (k) => `+${k} más` },
  pt: { one: 'Hoje: 1 jogo',            many: (n) => `Hoje: ${n} jogos`,           more: (k) => `+${k} mais` },
  fr: { one: "1 match aujourd'hui",     many: (n) => `${n} matchs aujourd'hui`,    more: (k) => `+${k} autres` },
  de: { one: 'Heute 1 Spiel',           many: (n) => `Heute ${n} Spiele`,          more: (k) => `+${k} weitere` },
  it: { one: 'Oggi 1 partita',          many: (n) => `Oggi ${n} partite`,          more: (k) => `+${k} altre` },
  ar: { one: 'لديك مباراة واحدة اليوم', many: (n) => `لديك ${n} مباريات اليوم`,    more: (k) => `+${k} أخرى` },
};

function buildSummaryContent(matches: Match[], lang: string) {
  const sx = SUMMARY_STRINGS[lang] ?? SUMMARY_STRINGS['en'];
  const n  = matches.length;
  const title = `📅 ${n === 1 ? sx.one : sx.many(n)}`;

  const lines = matches.slice(0, SUMMARY_LINES).map((m) => {
    const emoji = SPORT_EMOJI[m.sport ?? 'football'] ?? '🏆';
    const time  = formatLocalTime(new Date(m.date), getDeviceTimezone());
    return m.sport === 'motorsport'
      ? `${emoji} ${time} ${m.homeTeamName}`
      : `${emoji} ${time} ${m.homeTeamName} - ${m.awayTeamName}`;
  });
  if (n > SUMMARY_LINES) lines.push(sx.more(n - SUMMARY_LINES));

  return { title, body: lines.join('\n') };
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

  // Push sunucusunu güncel takım seçimiyle bilgilendir — boş liste dahil, takip
  // bırakılınca sunucu göndermeyi kesmeli. Push aktifse küratörlü (`daily_`) maçların
  // bildirimini sunucu gönderir; burada kurulursa aynı maç iki kez bildirilir.
  // Hiçbir zaman hata fırlatmaz; başarısızsa false döner ve aşağısı eskisi gibi çalışır.
  // Kullanıcının bildirim istediği dallar (varsayılan: hepsi). Sunucu da aynı listeye
  // göre süzer; yoksa küratörlü maçlarda seçim etkisiz kalırdı.
  const dallar = await getNotifySports();

  const pushAktif = await pushKaydiniGuncelle(selectedTeamIds, lang, matches.map(m => m.id), dallar);

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
    if (!dallar.includes((match.sport ?? 'football') as NotifySport)) continue;   // kullanıcı bu dalı kapattı
    if (pushAktif && match.id.startsWith('daily_')) continue;   // sunucu gönderecek

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

  // Sabah özeti — push aktifse sunucu gönderir, burada kurulmaz (çift bildirim olmasın).
  if (!pushAktif) {
    const ozet = new Date();
    ozet.setHours(SUMMARY_HOUR, 0, 0, 0);
    if (ozet > now) {
      const bugun = now.toDateString();
      const gunun = matches
        .filter((m) => {
          const t = new Date(m.date);
          return t.toDateString() === bugun
            && t > ozet
            && (selectedTeamIds.includes(m.homeTeam) || selectedTeamIds.includes(m.awayTeam))
            && dallar.includes((m.sport ?? 'football') as NotifySport);
        })
        .sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());

      if (gunun.length > 0) {
        const { title, body } = buildSummaryContent(gunun, lang);
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: ozet },
        });
        newMap[`ozet_${bugun}`] = id;
      }
    }
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
