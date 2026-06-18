/**
 * timezone.ts
 * Tüm timezone hesaplamaları bu dosyada.
 *
 * Temel kural:
 *  - Saat GÖSTERİMİ → her zaman cihazın gerçek IANA timezone'u (getDeviceTimezone)
 *  - Ülke seçimi → sadece hangi maçların ve hangi kanalların gösterileceğini etkiler
 *  - Dil seçimi → saat dilimiyle tamamen bağımsız
 */

/**
 * Cihazın gerçek IANA timezone'unu döner.
 * Örn: "Europe/Istanbul", "Europe/London", "America/New_York"
 * DST değişimlerini otomatik yönetir, hardcode offset kullanmaz.
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

// "YYYY-MM-DD" olarak yerel tarihi verir
export function localDateOf(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// "HH:MM" olarak yerel saati verir
export function formatLocalTime(date: Date, tz: string): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Verilen TZ'de yerel (y, mo, d, hh, mm) anının UTC timestamp'ini döner
function localToUTCMs(y: number, mo: number, d: number, hh: number, mm: number, tz: string): number {
  // Hermes'te formatToParts desteklenmeyebilir; toLocaleString('sv-SE') kullan.
  // sv-SE locale'i "YYYY-MM-DD HH:MM:SS" formatı döner — parse etmesi kolay ve kararlı.
  const noonRef = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  try {
    const localStr = noonRef.toLocaleString('sv-SE', { timeZone: tz });
    // "2026-06-18 15:30:00"
    const [datePart, timePart] = localStr.split(' ');
    const [ly, lmo, ld] = datePart.split('-').map(Number);
    const [lhh, lmm]   = timePart.split(':').map(Number);
    const localNoonMs  = Date.UTC(ly, lmo - 1, ld, lhh, lmm);
    const offsetMs     = localNoonMs - noonRef.getTime();
    return Date.UTC(y, mo - 1, d, hh, mm, 0) - offsetMs;
  } catch {
    // Fallback: cihazın kendi offset'i
    const offsetMs = -(new Date().getTimezoneOffset()) * 60_000;
    return Date.UTC(y, mo - 1, d, hh, mm, 0) - offsetMs;
  }
}

/**
 * Gösterim penceresi: bugünün 00:00'ından ertesi gün 09:00'a kadar (user TZ)
 */
export function getMatchWindow(tz: string): { start: Date; end: Date } {
  try {
    const now         = new Date();
    const todayLocal  = localDateOf(now, tz);               // "YYYY-MM-DD"
    const [y, mo, d]  = todayLocal.split('-').map(Number);

    const start = new Date(localToUTCMs(y, mo, d,     0, 0, tz));  // bugün 00:00
    const end   = new Date(localToUTCMs(y, mo, d + 1, 9, 0, tz));  // ertesi 09:00 (JS overflow-safe)

    return { start, end };
  } catch {
    // Herhangi bir Intl hatası olursa ±1 günlük geniş pencere kullan
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    return { start, end };
  }
}

/**
 * Pencere için gerekli UTC tarihlerini döner.
 * Örnek TR (UTC+3): [dün UTC, bugün UTC] → 1-3 gün
 */
export function getUTCDatesForWindow(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   end.getUTCDate()));

  while (cur.getTime() <= last.getTime()) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}
