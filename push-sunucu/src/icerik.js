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

// ─── Sabah ozeti ─────────────────────────────────────────────────────────────
// Kullanici istegi (20 Eyl 2026): "favoriye aldigi bir mac varsa sabah da bir kere
// bildirim atsin, 15 dk kala bildirim de devam etsin." Bu EK bir bildirimdir.

/** Abonenin yerel saatiyle ozetin gonderilecegi saat. */
export const OZET_SAAT = 9;

const OZET = {
  tr: { tek: 'Bugün 1 maçın var', cok: (n) => `Bugün ${n} maçın var`, daha: (k) => `+${k} maç daha` },
  en: { tek: '1 match today',     cok: (n) => `${n} matches today`,    daha: (k) => `+${k} more` },
  es: { tek: 'Hoy tienes 1 partido', cok: (n) => `Hoy tienes ${n} partidos`, daha: (k) => `+${k} más` },
  pt: { tek: 'Hoje: 1 jogo',      cok: (n) => `Hoje: ${n} jogos`,      daha: (k) => `+${k} mais` },
  fr: { tek: "1 match aujourd'hui", cok: (n) => `${n} matchs aujourd'hui`, daha: (k) => `+${k} autres` },
  de: { tek: 'Heute 1 Spiel',     cok: (n) => `Heute ${n} Spiele`,     daha: (k) => `+${k} weitere` },
  it: { tek: 'Oggi 1 partita',    cok: (n) => `Oggi ${n} partite`,     daha: (k) => `+${k} altre` },
  ar: { tek: 'لديك مباراة واحدة اليوم', cok: (n) => `لديك ${n} مباريات اليوم`, daha: (k) => `+${k} أخرى` },
};

const OZET_SATIR = 3;   // bildirimde en fazla bu kadar mac adi; gerisi "+N"

/**
 * Bir abonenin bugunku maclarinin tek bildirimlik ozeti.
 * @param maclar [{ kickoff, veri }] — saate gore sirali olmali
 */
export function ozetIcerigi(maclar, abone) {
  const o = OZET[abone.dil] ?? OZET.en;
  const n = maclar.length;
  const title = `📅 ${n === 1 ? o.tek : o.cok(n)}`;

  const satirlar = maclar.slice(0, OZET_SATIR).map((m) => {
    const emoji = EMOJI[m.veri.sport] ?? '🏆';
    const ev    = sec(m.veri.homeNames, abone.dil, m.veri.home);
    const dep   = sec(m.veri.awayNames, abone.dil, m.veri.away);
    const saat  = yerelSaat(m.kickoff, abone.tz);
    return m.veri.sport === 'motorsport'
      ? `${emoji} ${saat} ${ev}`
      : `${emoji} ${saat} ${ev} - ${dep}`;
  });
  if (n > OZET_SATIR) satirlar.push(o.daha(n - OZET_SATIR));

  return { title, body: satirlar.join('\n') };
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
