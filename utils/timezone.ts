/**
 * timezone.ts
 * Tüm timezone hesaplamaları bu dosyada.
 * Cihaz timezone'u hiçbir zaman kullanılmaz.
 * Kullanıcının seçtiği ülke TZ'si kullanılır.
 */

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
  // Aynı takvim günündeki öğlen UTC'yi referans alarak TZ offset'i hesapla
  // (gece yarısı DST geçişlerinde daha güvenilir)
  const noonRef = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(noonRef);
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0');
  const localNoonMs = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  const offsetMs    = localNoonMs - noonRef.getTime();

  // Hedef anı UTC'ye çevir (JS Date.UTC ay/gün taşmasını halleder)
  return Date.UTC(y, mo - 1, d, hh, mm, 0) - offsetMs;
}

/**
 * Gösterim penceresi: bugünün 00:00'ından ertesi gün 09:00'a kadar (user TZ)
 */
export function getMatchWindow(tz: string): { start: Date; end: Date } {
  const now         = new Date();
  const todayLocal  = localDateOf(now, tz);               // "YYYY-MM-DD"
  const [y, mo, d]  = todayLocal.split('-').map(Number);

  const start = new Date(localToUTCMs(y, mo, d,     0, 0, tz));  // bugün 00:00
  const end   = new Date(localToUTCMs(y, mo, d + 1, 9, 0, tz));  // ertesi 09:00 (JS overflow-safe)

  return { start, end };
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
