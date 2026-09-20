// Saf mantik — Cloudflare'e bagli degil, node ile test edilir (test/icerik.test.mjs).
//
// Bildirim metni uygulamanin services/notificationService.ts -> buildNotificationContent
// fonksiyonuyla BIREBIR ayni uretilir. Uygulamayi acan kullaniciya yerel bildirim,
// acmayana push gidebilir; ikisi ayni gorunmeli.

import { TAKIM_ESLEME } from './takimlar.js';

export const HATIRLAT_DK = 15;

const EMOJI = { football: '⚽', basketball: '🏀', volleyball: '🏐', motorsport: '🏎️' };

const METIN = {
  tr: { kaldi: `${HATIRLAT_DK} dk kaldı`,            on: '',    not: '(Sadece maç saati hatırlatıcısı. Gol bildirimi verilmez.)' },
  en: { kaldi: `${HATIRLAT_DK} min to kickoff`,      on: 'on',  not: '(Match time reminder only. No goal alerts.)' },
  es: { kaldi: `comienza en ${HATIRLAT_DK} min`,     on: 'en',  not: '(Solo recordatorio de hora. Sin alertas de goles.)' },
  pt: { kaldi: `começa em ${HATIRLAT_DK} min`,       on: 'na',  not: '(Apenas lembrete de horário. Sem alertas de gol.)' },
  fr: { kaldi: `dans ${HATIRLAT_DK} min`,            on: 'sur', not: "(Rappel d'heure uniquement. Pas d'alertes de but.)" },
  de: { kaldi: `in ${HATIRLAT_DK} Min`,              on: 'auf', not: '(Nur Spielzeit-Erinnerung. Keine Tor-Benachrichtigungen.)' },
  it: { kaldi: `tra ${HATIRLAT_DK} minuti`,          on: 'su',  not: '(Solo promemoria orario. Nessun avviso gol.)' },
  ar: { kaldi: `يبدأ بعد ${HATIRLAT_DK} دقيقة`,       on: 'على', not: '(تذكير بموعد المباراة فقط. لا إشعارات أهداف.)' },
};

/** Uygulamanin 1.4.3'teki norm() fonksiyonu — favori eslesmesi buna gore yapiliyor. */
export const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22);

/** Dosyadaki takim adini, onu takip edebilecek UYGULAMA takim kimliklerine cevirir. */
export function takimKimlikleri(ad) {
  const n = norm(ad);
  if (!n) return [];
  return TAKIM_ESLEME[n] ?? [n];   // tabloda yoksa uygulamanin kendi eslesmesi (norm === id)
}

/** Kullanicinin dilindeki karsilik; yoksa Ingilizce, o da yoksa taban ad (uygulamadaki pick). */
export function sec(adlar, dil, yedek) {
  if (!adlar) return yedek;
  const taban = String(dil || 'en').split('-')[0];
  return adlar[taban] || adlar.en || yedek;
}

export function yerelSaat(ms, tz) {
  try {
    return new Date(ms).toLocaleTimeString('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}

/**
 * Uygulama bir maci ancak kullanicinin ulkesinde kanali varsa ya da tier 'global' ise
 * listeliyor (dailyMatchService). Gormedigi mac icin bildirim gitmesin.
 */
export function gorunurMu(mac, ulke) {
  const kanallar = mac.broadcasts?.[ulke] ?? [];
  return kanallar.length > 0 || mac.tier === 'global';
}

/** Fikstur kaydini plana yazilacak sade hale getirir. Takip edilebilir takimi yoksa null. */
export function planKaydi(r) {
  const kickoff = Date.parse(r.kickoffUtc);
  if (!Number.isFinite(kickoff)) return null;
  const takimlar = [...new Set([...takimKimlikleri(r.home), ...takimKimlikleri(r.away)])];
  if (takimlar.length === 0) return null;
  return {
    mac_id: r.id,
    kickoff,
    takimlar,
    veri: {
      sport: r.sport, tier: r.tier,
      competition: r.competition, competitionId: r.competitionId,
      home: r.home, away: r.away,
      homeNames: r.homeNames, awayNames: r.awayNames,
      broadcasts: r.broadcasts ?? {},
    },
  };
}

/** Bildirim zamani geldi mi: maca 15 dk veya daha az kaldi ve mac henuz baslamadi. */
export function zamaniGeldiMi(kickoff, simdi) {
  return kickoff - HATIRLAT_DK * 60_000 <= simdi && simdi < kickoff;
}

export function bildirimIcerigi(veri, kickoff, abone) {
  const s     = METIN[abone.dil] ?? METIN.en;
  const emoji = EMOJI[veri.sport] ?? '🏆';
  const ev    = sec(veri.homeNames, abone.dil, veri.home);
  const dep   = sec(veri.awayNames, abone.dil, veri.away);

  const title = veri.sport === 'motorsport'
    ? `${emoji} ${ev} – ${s.kaldi}!`
    : `${emoji} ${ev} vs ${dep} – ${s.kaldi}!`;

  const kanal = (veri.broadcasts?.[abone.ulke] ?? [])[0] ?? '';
  const lig   = sec(veri.competition, abone.dil, veri.competitionId);
  const body  = [
    `🕐 ${yerelSaat(kickoff, abone.tz)} | ${lig}`,
    kanal ? `📺 ${s.on ? s.on + ' ' : ''}${kanal}` : '',
    s.not,
  ].filter(Boolean).join('\n');

  return { title, body };
}

// ─── Kayit dogrulama ─────────────────────────────────────────────────────────

const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/;
const TAKIM_RE = /^[a-z0-9_]{2,40}$/;

/** Uygulamadaki dal kimlikleri (constants/matches.ts). */
export const DALLAR = ['football', 'basketball', 'volleyball', 'motorsport'];

export function kayitDogrula(g) {
  if (!g || typeof g !== 'object') return { hata: 'govde yok' };
  if (typeof g.token !== 'string' || !TOKEN_RE.test(g.token)) return { hata: 'token gecersiz' };
  if (!Array.isArray(g.takimlar) || g.takimlar.length > 200) return { hata: 'takimlar gecersiz' };
  const takimlar = [...new Set(g.takimlar.filter((t) => typeof t === 'string' && TAKIM_RE.test(t)))];
  if (typeof g.ulke !== 'string' || !/^[A-Z]{2}$/.test(g.ulke)) return { hata: 'ulke gecersiz' };

  const dil = typeof g.dil === 'string' && /^[a-z]{2}$/.test(g.dil) ? g.dil : 'en';
  let tz = 'UTC';
  if (typeof g.tz === 'string' && g.tz.length <= 64) {
    try { new Intl.DateTimeFormat('en-GB', { timeZone: g.tz }); tz = g.tz; } catch { /* UTC */ }
  }
  const platform = typeof g.platform === 'string' ? g.platform.slice(0, 10) : '';
  // Kullanicinin bildirim istedigi spor dallari. Eski uygulama surumleri bu alani
  // hic gondermez -> hepsi acik sayilir (eski davranis birebir korunur).
  const dallar = Array.isArray(g.dallar)
    ? DALLAR.filter((d) => g.dallar.includes(d))
    : [...DALLAR];
  return {
    deger: { token: g.token, takimlar, dil, ulke: g.ulke, tz, platform,
             dallar: dallar.length ? dallar : [...DALLAR] },
  };
}
