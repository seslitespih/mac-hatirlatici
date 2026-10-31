#!/usr/bin/env node
// OTOMATİK FİKSTÜR — yapay zekâ / API kredisi KULLANMAZ (28 Eki 2026).
// GitHub Actions `auto-fixtures.yml` günde 4 kez çalıştırır; Claude limiti bitse de, bilgisayar kapalı olsa da sürer.
//
// Kaynaklar (hepsi açık sayfa, anahtar gerekmez):
//   futbol + kanallar  FotMob ülke TV rehberleri  fotmob.com/en/tv-guide/<ülke>  (UTC saat, 33 ülke)
//   MENA kanal + Arapça ad  kooora  .../مباريات-اليوم?date=YYYY-MM-DD
//   Türkiye Kupası     A Spor yayın akışı (yalnız bugün; "Ztk / Ev - Deplasman" satırları)
//   EuroLeague/EuroCup resmi API  api-live.euroleague.net
//   NBA ve kadın futbolu/U21 filtresi ayrı betikler: nba.mjs, filtre.mjs (iş akışı sırayla çalıştırır)
// Eski TR kaynağı hangikanalda.app 28 Eki'de satılık alan adına döndü — KULLANMA.
//
// Kullanım: node scripts/otomatik-fikstur.mjs [--date YYYY-MM-DD] [--out assets/matches-daily.json]
// Birleştirme: dosya aynı günün dosyasıysa içindeki maçlara DOKUNMAZ (elle girilen veri korunur), yalnız eksik maç
// ve eksik ülke kanalı ekler. assets/kuyruk/<gün>.json (önceden hazırlanmış gün) varsa onun eksiklerini de ekler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const BUGUN_TR = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);   // Türkiye UTC+3, yaz saati yok
const GUN = arg('--date') || BUGUN_TR;
const OUT = path.resolve(KOK, arg('--out') || 'assets/matches-daily.json');
const KUYRUK = path.join(KOK, 'assets', 'kuyruk', `${GUN}.json`);
const BAS = Date.parse(`${GUN}T00:00:00+03:00`);
const SON = Date.parse(`${GUN}T00:00:00Z`) + 27 * 3600e3;                          // ertesi gün 03:00 UTC (talimat §2b)
const ertesi = g => new Date(Date.parse(`${g}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);

const SOZ = JSON.parse(fs.readFileSync(path.join(KOK, 'scripts', 'otomatik-sozluk.json'), 'utf8'));
const DIL = ['tr', 'en', 'de', 'es', 'fr', 'it', 'pt', 'ar'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const n = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const ascii = s => String(s).replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ğ/g, 'g')
  .replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ü/g, 'u').replace(/Ü/g, 'U')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/ß/g, 'ss');
const slug = s => ascii(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const arapca = s => /[؀-ۿ]/.test(s || '');
const hepsi = ad => Object.fromEntries(DIL.map(l => [l, ad]));

// Uygulamanın takım kimlikleri (constants/teams.ts) — favori bildirimi norm(home/away) === id ile eşleşir
const TAKIM_SATIR = fs.readFileSync(path.join(KOK, 'constants', 'teams.ts'), 'utf8').split('\n').filter(l => /id: '/.test(l));
const APP = new Set(TAKIM_SATIR.map(l => l.match(/id: '([^']+)'/)[1]));
const APP_FUTBOL = new Set(TAKIM_SATIR.filter(l => !/sport: '(basketball|volleyball|motorsport)'/.test(l)).map(l => l.match(/id: '([^']+)'/)[1]));

// ── Turnuvalar ───────────────────────────────────────────────────────────────
// FotMob lig kimliği -> competitionId (geçmiş dosyalardaki kimlikler; tier ve 8 dil ad sözlükten gelir)
const LIG = { 47: 'premier', 87: 'laliga', 55: 'seriea', 54: 'bundesliga', 53: 'ligue1', 71: 'superlig', 61: 'primeira',
  42: 'champions', 73: 'europa', 10216: 'conference', 268: 'bra_seriea', 8814: 'bra_serieb', 9067: 'copa_do_brasil',
  45: 'libertadores', 299: 'sudamericana', 112: 'arg_primera', 9305: 'copa_argentina', 130: 'mls', 230: 'liga_mx',
  536: 'saudi_pl', 525: 'afc_cl', 274: 'liga_dimayor', 273: 'liga_primera', 131: 'liga1_pe', 246: 'liga_pro_ec',
  161: 'liga_auf', 10342: 'copa_auf', 199: 'primera_py', 10230: 'copa_paraguay', 64: 'scot_prem', 180: 'scot_lc',
  209: 'dfb_pokal', 133: 'efl_cup', 132: 'fa_cup', 138: 'copa_del_rey', 141: 'coppa_italia', 134: 'coupe_de_france',
  187: 'taca_da_liga', 165: 'tff1', 140: 'laliga2', 86: 'seriebit', 146: 'bundesliga2', 110: 'ligue2', 185: 'primeira2',
  57: 'eredivisie', 48: 'championship', 108: 'league_one', 8972: 'usl', 38: 'aut_bundesliga', 441: 'ukr_pl', 530: 'botola' };
// Kimliğinden emin olunmayanlar ada göre (ülke kodu | FotMob lig adı)
const LIG_AD = { 'POR|Taça de Portugal': 'taca_portugal', 'TUR|Turkish Cup': 'turkiye_kupasi', 'AZE|Premier League': 'aze_pl',
  'INT|Copa Libertadores': 'libertadores', 'INT|Copa Sudamericana': 'sudamericana', 'INT|Europa League': 'europa',
  'INT|Conference League': 'conference', 'INT|Friendlies': 'friendly', 'INT|UEFA Nations League A': 'uefa_nations',
  'INT|UEFA Nations League B': 'uefa_nations', 'INT|UEFA Nations League C': 'uefa_nations', 'INT|UEFA Nations League D': 'uefa_nations',
  'INT|World Cup Qualification UEFA': 'wc_qual_uefa', 'INT|World Cup Qualification CONMEBOL': 'wc_qual_conmebol' };
const YENI_LIG = {
  copa_del_rey: ['regional', { tr: 'İspanya Kral Kupası', en: 'Copa del Rey', de: 'Copa del Rey', es: 'Copa del Rey', fr: 'Coupe du Roi', it: 'Coppa del Re', pt: 'Copa do Rei', ar: 'كأس ملك إسبانيا' }],
  taca_da_liga: ['regional', { tr: 'Portekiz Lig Kupası', en: 'Taça da Liga', de: 'Taça da Liga', es: 'Copa de la Liga de Portugal', fr: 'Coupe de la Ligue portugaise', it: 'Taça da Liga', pt: 'Taça da Liga', ar: 'كأس الدوري البرتغالي' }],
  fa_cup: ['global', { tr: 'İngiltere FA Cup', en: 'FA Cup', de: 'FA Cup', es: 'FA Cup', fr: 'FA Cup', it: 'FA Cup', pt: 'FA Cup', ar: 'كأس الاتحاد الإنجليزي' }],
  coupe_de_france: ['regional', { tr: 'Fransa Kupası', en: 'Coupe de France', de: 'Coupe de France', es: 'Copa de Francia', fr: 'Coupe de France', it: 'Coppa di Francia', pt: 'Taça de França', ar: 'كأس فرنسا' }],
  alg_l1: ['regional', { tr: 'Cezayir Ligue 1', en: 'Algerian Ligue 1', de: 'Algerische Ligue 1', es: 'Liga de Argelia', fr: 'Ligue 1 Mobilis', it: 'Ligue 1 algerina', pt: 'Liga Argelina', ar: 'الرابطة الجزائرية المحترفة الأولى' }],
  alg_cup: ['regional', { tr: 'Cezayir Kupası', en: 'Algerian Cup', de: 'Algerischer Pokal', es: 'Copa de Argelia', fr: "Coupe d'Algérie", it: "Coppa d'Algeria", pt: 'Taça da Argélia', ar: 'كأس الجزائر' }],
  botola: ['regional', { tr: 'Fas Botola Pro', en: 'Botola Pro', de: 'Botola Pro', es: 'Botola Pro', fr: 'Botola Pro', it: 'Botola Pro', pt: 'Botola Pro', ar: 'البطولة الاحترافية' }],
  wc_qual_uefa: ['global', { tr: 'Dünya Kupası Elemeleri (Avrupa)', en: 'World Cup Qualifiers (UEFA)', de: 'WM-Qualifikation (UEFA)', es: 'Eliminatorias Mundial (UEFA)', fr: 'Qualifications Coupe du monde (UEFA)', it: 'Qualificazioni Mondiali (UEFA)', pt: 'Eliminatórias da Copa (UEFA)', ar: 'تصفيات كأس العالم (أوروبا)' }],
  wc_qual_conmebol: ['global', { tr: 'Dünya Kupası Elemeleri (Güney Amerika)', en: 'World Cup Qualifiers (CONMEBOL)', de: 'WM-Qualifikation (CONMEBOL)', es: 'Eliminatorias Sudamericanas', fr: 'Qualifications Coupe du monde (CONMEBOL)', it: 'Qualificazioni Mondiali (CONMEBOL)', pt: 'Eliminatórias Sul-Americanas', ar: 'تصفيات كأس العالم (أمريكا الجنوبية)' }],
};
const ligBilgi = (cid, fmAd) => {
  if (SOZ.ligler[cid]) return { tier: SOZ.ligler[cid].tier, names: SOZ.ligler[cid].names };
  if (YENI_LIG[cid]) return { tier: YENI_LIG[cid][0], names: YENI_LIG[cid][1] };
  return { tier: 'regional', names: hepsi(fmAd || cid) };
};
// Alt turları çok kalabalık kupalar: yalnız uygulama takımı oynuyorsa ya da en az 2 ülkede yayın varsa
// (Kral Kupası'nda LaLiga takımının maçı ES + US (ESPN); alt lig eşleşmesi yalnız bölge kanalı ya da hiç)
const KALABALIK_KUPA = new Set(['copa_del_rey', 'coppa_italia', 'fa_cup', 'coupe_de_france', 'taca_portugal', 'dfb_pokal', 'efl_cup']);
const KADIN_GENC = /women|\(w\)|femen|femin|frauen|vrouwen|damallsvenskan|toppserien|\bwsl\b|nwsl|liga f\b|premiere ligue|youth|u1[5-9]\b|u2[0-3]\b|reserve/i;

// ── Takım adları ─────────────────────────────────────────────────────────────
// FotMob adı -> uygulamanın takım kimliğiyle tutan ad. Genel ön ek silme KULLANMA: "Liverpool FC" Uruguay takımı.
const ALIAS = { milan: 'AC Milan', acmilan: 'AC Milan', bayernmunchen: 'Bayern Munich', fcbayernmunchen: 'Bayern Munich',
  bayernmunich: 'Bayern Munich', bayernmunih: 'Bayern Munich', atleticomadrid: 'Atletico', eintrachtfrankfurt: 'Frankfurt',
  parissaintgermain: 'PSG', manchestercity: 'Man City', manchesterunited: 'Man Utd', tottenhamhotspur: 'Tottenham',
  newcastleunited: 'Newcastle', westhamunited: 'West Ham', brightonhovealbion: 'Brighton', borussiadortmund: 'Dortmund',
  bayerleverkusen: 'Leverkusen', vflwolfsburg: 'Wolfsburg', olympiquelyonnais: 'Lyon', olympiquedemarseille: 'Marseille',
  asmonaco: 'Monaco', losclille: 'Lille', ogcnice: 'Nice', internazionale: 'Inter', asroma: 'Roma', sslazio: 'Lazio',
  caykurrizespor: 'Rizespor', corendonalanyaspor: 'Alanyaspor', tumosankonyaspor: 'Konyaspor', athleticbilbao: 'Athletic Club',
  realbetis: 'Betis', villarrealcf: 'Villarreal', valenciacf: 'Valencia', sevillafc: 'Sevilla', heartofmidlothian: 'Hearts' };
// Futbol takımıyla aynı adı taşıyan basketbol kulüpleri dal markasıyla yazılır (talimat §3 — yoksa futbol favorisine bildirim gider)
const BASKET_AD = { besiktas: 'Beşiktaş GAIN', besiktasistanbul: 'Beşiktaş GAIN', galatasaray: 'Galatasaray MCT Technic',
  fenerbahce: 'Fenerbahçe Beko', fenerbahcebekoistanbul: 'Fenerbahçe Beko', realmadrid: 'Real Madrid Baloncesto',
  barcelona: 'Barça Basket', fcbarcelona: 'Barça Basket', anadoluefesistanbul: 'Anadolu Efes', hapoelibitelaviv: 'Hapoel Tel Aviv',
  umanareyervenice: 'Reyer Venezia', recoletassaludsanpabloburgos: 'San Pablo Burgos', hapoelmidtownjerusalem: 'Hapoel Jerusalem',
  bagliettoderthonatortona: 'Derthona Tortona', coseajlbourgenbresse: 'JL Bourg', monaco: 'AS Monaco Basket', asmonaco: 'AS Monaco Basket',
  bayernmunich: 'Bayern Basketball', fcbayernmunich: 'Bayern Basketball', virtussegafredobologna: 'Virtus Bologna' };

function takim(ad, arKoo, spor = 'football') {
  let home = ad, names = null;
  const al = spor === 'football' ? ALIAS[n(ad)] : BASKET_AD[n(ad)];
  const s = SOZ.takimlar[n(al || ad)];
  if (s && s.sport === spor) { home = s.home; names = { ...s.names }; }
  else if (al) home = al;
  if (spor === 'football' && ALIAS[n(home)]) home = ALIAS[n(home)];           // sözlükteki eski hatalı yazımlar (Bayern Munih)
  if (spor !== 'football' && APP_FUTBOL.has(n(home))) home += ' Basket';
  names = Object.fromEntries(DIL.map(l => [l, names?.[l] || (l === 'ar' ? arKoo || al || ad : al || ad)]));
  if (arKoo && !arapca(names.ar)) names.ar = arKoo;
  return { home: ascii(home), names };
}

// ── Kanal adları ─────────────────────────────────────────────────────────────
const kanalDuzelt = k => k.replace(/^bein\s*sports/i, 'beIN Sports').replace(/^bein\s*connect/i, 'beIN CONNECT')
  .replace(/^beIN Sports CONNECT$/i, 'beIN CONNECT').replace(/^Caze TV$/i, 'CazéTV').replace(/\s+(Turkey|Türkiye)$/i, '').trim();
const once = k => /^(beIN Sports \d|beIN Sports MENA|TRT|A Spor|S Sport|TV8|ATV|Sky|DAZN|Canal|ESPN|TNT|Sport TV|Movistar)/i.test(k) ? 0 : 1;
// FotMob kanal yerine yer tutucu yazabiliyor ("Canal por confirmar" — 26/28 Eki dosyalarına 35 ülkede kanal diye girdi)
const YER_TUTUCU = /por confirmar|a confirmar|to be confirmed|\btb[ca]\b|confirmer|confermare|a definir|SIN TV|^\*/i;
const temizKanal = ks => [...new Set(ks.filter(x => x && !YER_TUTUCU.test(x)).map(kanalDuzelt))].sort((a, b) => once(a) - once(b)).slice(0, 4);
const MENA_ULKE = ['SA', 'QA', 'AE', 'EG', 'MA', 'DZ', 'TN', 'IQ', 'JO', 'OM', 'LY', 'KW', 'BH'];
const menaKanal = tv => [...new Set((tv || []).filter(x => /bein sports m(ena|ax)|^tod|alkass|abu dhabi|ad sports|ssc|shahid|شاهد|thmanyah|ثمانية/i.test(x))
  .map(x => x.replace(/beIN Sports M[Ee][Nn][Aa]/, 'beIN Sports MENA')))].slice(0, 4);

// ── Ağ ───────────────────────────────────────────────────────────────────────
const rapor = [];
async function al(url, tur = 'text') {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(40000) });
      if (r.ok) return tur === 'json' ? await r.json() : await r.text();
      if (i) rapor.push(`HATA ${r.status} ${url}`);
    } catch (e) { if (i) rapor.push(`HATA ${e.name} ${url}`); }
  }
  return null;
}
const nextData = h => { const m = h && h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); try { return m && JSON.parse(m[1]); } catch { return null; } };

// ── 1) FotMob ────────────────────────────────────────────────────────────────
const ULKELER = ['TR', 'GB', 'ES', 'PT', 'FR', 'DE', 'IT', 'BE', 'NL', 'CH', 'HR', 'NO', 'AT', 'CZ', 'BR', 'AR', 'MX', 'US', 'CO', 'CA',
  'JP', 'KR', 'AU', 'NZ', 'NG', 'MA', 'ZA', 'GH', 'CL', 'PE', 'UY', 'EC', 'PY'];
const fm = {};
let fmTamam = 0;
for (let i = 0; i < ULKELER.length; i += 8) {
  await Promise.all(ULKELER.slice(i, i + 8).map(async cc => {
    const fb = nextData(await al(`https://www.fotmob.com/en/tv-guide/${cc.toLowerCase()}`))?.props?.pageProps?.fallback;
    const k = fb && Object.keys(fb).find(x => x.startsWith('tvguide-groups'));
    if (!k) return;
    fmTamam++;
    for (const grp of Object.values(fb[k])) for (const g of grp) for (const m of g.matches || []) {
      const t = Date.parse(m.utcTime);
      if (!(t >= BAS && t < SON)) continue;
      const x = fm[m.id] ??= { utc: m.utcTime, home: m.home.name, away: m.away.name, lid: m.leagueId, lig: m.leagueName, cc: m.leagueCcode, kanal: {} };
      const ks = temizKanal((m.channels || []).map(c => c.name));
      if (ks.length) x.kanal[cc] = ks;
    }
  }));
}
rapor.push(`FotMob: ${fmTamam}/${ULKELER.length} ülke rehberi, pencerede ${Object.keys(fm).length} maç`);

// ── 2) kooora (MENA) ─────────────────────────────────────────────────────────
const KOO = 'https://www.kooora.com/%D9%83%D8%B1%D8%A9-%D8%A7%D9%84%D9%82%D8%AF%D9%85/%D9%85%D8%A8%D8%A7%D8%B1%D9%8A%D8%A7%D8%AA-%D8%A7%D9%84%D9%8A%D9%88%D9%85';
// goal.com kooora ile aynı veri altyapısında: maç kimlikleri aynı, takım adları İngilizce → kooora maçını FotMob maçına ADLA bağlar
const goalEn = {};
const topla = o => {
  if (!o || typeof o !== 'object') return;
  if (o.id && o.teamA?.name && o.teamB?.name) goalEn[o.id] = { home: o.teamA.name, away: o.teamB.name };
  for (const v of Object.values(o)) topla(v);
};
const kooora = [];
for (const g of [GUN, ertesi(GUN)]) {
  topla(nextData(await al(`https://www.goal.com/en/live-scores?date=${g}`))?.props?.pageProps);
  for (const grp of nextData(await al(`${KOO}?date=${g}`))?.props?.pageProps?.data || []) for (const x of grp.matches || []) {
    // ertelenen maç eski saatinde listede kalıyor (31 Eki: Cezayir 10. haftanın 8 maçı) — alma
    if (kooora.some(k => k.id === x.id) || /POSTPON|CANCEL|ABANDON|SUSPEND/i.test(x.status || '')) continue;
    kooora.push({ id: x.id, comp: (grp.competition?.name || x.competition?.name || '').replace(/\s+/g, ' ').trim(), start: x.startDate,
      home: x.teamA?.name, away: x.teamB?.name, tv: (x.tvChannels || []).map(c => c.name || c.title || c) });
  }
}
for (const k of kooora) { k.enHome = goalEn[k.id]?.home; k.enAway = goalEn[k.id]?.away; }
rapor.push(`kooora: ${kooora.length} maç (${kooora.filter(k => k.enHome).length} İngilizce adlı, goal.com)`);

// Aynı maç: iki taraf da benzemeli ("Bayern Munich - Magdeburg" = "Bayern Munich - FC Magdeburg").
// Tek taraf yetmez: aynı saatte "Manchester City - X" ile "Manchester United - Y" birleşirdi.
const tok = s => ascii(s).toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 4 &&
  !/^(club|deportivo|futbol|basket|sport|spor|united|city|real|atletico|sporting|athletic|olympique|internacional)$/.test(x));
const ortak = (a, b) => n(a).includes(n(b)) || n(b).includes(n(a)) ||
  tok(a).some(t => tok(b).some(u => t === u || (Math.min(t.length, u.length) >= 5 && (t.startsWith(u) || u.startsWith(t)))));   // Yildirimspor ~ Yildirim

const kooKullanildi = new Set();
function kooBul(utc, ev, dep, lig = null) {
  const ad = kooora.filter(k => !kooKullanildi.has(k.id) && Date.parse(k.start) === Date.parse(utc) && (!lig || lig.test(k.comp)));
  // 1) İngilizce adla iki taraf  2) sözlükteki Arapça adla  3) o saatte tek aday
  let s = ad.filter(k => k.enHome && ortak(k.enHome, ev) && ortak(k.enAway, dep));
  if (s.length !== 1) {
    const arlar = [ev, dep].map(t => SOZ.takimlar[n(ALIAS[n(t)] || t)]?.names?.ar).filter(arapca);
    s = ad.filter(k => arlar.includes(k.home) || arlar.includes(k.away));
  }
  if (s.length !== 1) s = ad.length === 1 ? ad : [];
  if (!s.length) return null;
  kooKullanildi.add(s[0].id);
  return s[0];
}

// ── Maç kaydı ────────────────────────────────────────────────────────────────
const taze = [];
function kayit({ sport, cid, fmAd, utc, ev, dep, broadcasts, sources }) {
  const lb = ligBilgi(cid, fmAd);
  const kickoffUtc = new Date(utc).toISOString().replace('.000Z', 'Z');
  taze.push({ id: `${sport}-${kickoffUtc.slice(0, 10).replace(/-/g, '')}-${slug(ev.home)}-${slug(dep.home)}`,
    sport, competitionId: cid, tier: lb.tier, competition: lb.names, home: ev.home, away: dep.home,
    homeNames: ev.names, awayNames: dep.names, kickoffUtc, broadcasts, sources });
}

for (const m of Object.values(fm)) {
  if (KADIN_GENC.test(m.lig) || /\(W\)/.test(m.home + m.away)) continue;
  const appMaci = [m.home, m.away].some(t => APP.has(n(ALIAS[n(t)] || t)) || APP.has(n(SOZ.takimlar[n(t)]?.home)));
  let cid = LIG[m.lid] || LIG_AD[`${m.cc}|${m.lig}`];
  if (!cid && !appMaci) continue;                                   // altın kural: uygulama takımı oynuyorsa lig ne olursa girer
  cid ||= `fm_${m.lid}`;
  if (KALABALIK_KUPA.has(cid) && !appMaci && Object.keys(m.kanal).length < 2) continue;
  const koo = kooBul(m.utc, m.home, m.away);
  const broadcasts = { ...m.kanal };
  const mk = menaKanal(koo?.tv);
  if (mk.length) for (const cc of MENA_ULKE) { const k = mk.filter(x => !/alkass/i.test(x) || cc === 'QA'); if (k.length) broadcasts[cc] = k; }
  if (!Object.keys(broadcasts).length) continue;                    // regional + kanalsız = hiçbir yerde görünmez
  kayit({ sport: 'football', cid, fmAd: m.lig, utc: m.utc, ev: takim(m.home, koo?.home), dep: takim(m.away, koo?.away),
    broadcasts, sources: ['fotmob', ...(koo ? ['kooora'] : [])] });
}

// ── 2b) Yalnız kooora'da olan ligler (FotMob'un bu ülkeler için TV rehberi yok) ──
// Cezayir ve Brezilya en çok tercih eden pazarlar (kullanıcı, 31 Eki 2026) — Cezayir ligi buradan gelir.
const KOO_LIG = {
  'دوري روشن السعودي': { cid: 'saudi_pl', ulke: MENA_ULKE },
  'الرابطة الجزائرية المحترفة الأولى': { cid: 'alg_l1', ulke: ['DZ'] },
  'كأس الجزائر': { cid: 'alg_cup', ulke: ['DZ'] },
  'الدوري المصري الممتاز': { cid: 'egypt_pl', ulke: ['EG'] },
  'الدوري المغربي الممتاز': { cid: 'botola', ulke: ['MA'] },
  'الدوري الأذربيجاني': { cid: 'aze_pl', ulke: [], sabit: { TR: ['Idman TV'], AZ: ['CBC Sport', 'Idman TV'] } },
};
let kooEk = 0;
for (const k of kooora) {
  const L = KOO_LIG[k.comp];
  const t = Date.parse(k.start);
  if (!L || !(t >= BAS && t < SON) || kooKullanildi.has(k.id) || !k.enHome) continue;
  if (taze.some(m => Math.abs(Date.parse(m.kickoffUtc) - t) <= 3 * 3600e3 && ortak(m.home, k.enHome) && ortak(m.away, k.enAway))) continue;
  const tv = temizKanal(k.tv), mena = menaKanal(k.tv);
  const broadcasts = { ...(L.sabit || {}) };
  if (tv.length) for (const cc of L.ulke) broadcasts[cc] = tv;
  if (mena.length) for (const cc of MENA_ULKE) broadcasts[cc] ??= mena.filter(x => !/alkass/i.test(x) || cc === 'QA');
  for (const cc of Object.keys(broadcasts)) if (!broadcasts[cc].length) delete broadcasts[cc];
  if (!Object.keys(broadcasts).length && ligBilgi(L.cid).tier !== 'global') continue;
  kooKullanildi.add(k.id);
  kayit({ sport: 'football', cid: L.cid, utc: k.start, ev: takim(k.enHome, k.home), dep: takim(k.enAway, k.away), broadcasts, sources: ['kooora', 'goal.com'] });
  kooEk++;
}
rapor.push(`kooora'ya özel ligler (Suudi, Cezayir, Mısır, Fas, Azerbaycan): ${kooEk} maç`);

// ── 2c) Formula 1 — seans programı (jolpi.ca, Ergast'ın devamı; anahtar gerekmez) ──
const GP_AD = {
  Mexico: { tr: 'Meksika GP', en: 'Mexico City GP', de: 'Großer Preis von Mexiko', es: 'GP de México', fr: 'GP du Mexique', it: 'GP del Messico', pt: 'GP do México', ar: 'جائزة المكسيك الكبرى' },
  Brazil: { tr: 'Brezilya GP', en: 'São Paulo GP', de: 'Großer Preis von Brasilien', es: 'GP de Brasil', fr: 'GP du Brésil', it: 'GP del Brasile', pt: 'GP de São Paulo', ar: 'جائزة البرازيل الكبرى' },
  Qatar: { tr: 'Katar GP', en: 'Qatar GP', de: 'Großer Preis von Katar', es: 'GP de Catar', fr: 'GP du Qatar', it: 'GP del Qatar', pt: 'GP do Catar', ar: 'جائزة قطر الكبرى' },
  UAE: { tr: 'Abu Dabi GP', en: 'Abu Dhabi GP', de: 'Großer Preis von Abu Dhabi', es: 'GP de Abu Dabi', fr: "GP d'Abou Dhabi", it: 'GP di Abu Dhabi', pt: 'GP de Abu Dhabi', ar: 'جائزة أبوظبي الكبرى' },
};
const SEANS = {
  FirstPractice: { tr: '1. Antrenman', en: 'Practice 1', de: '1. Freies Training', es: 'Práctica 1', fr: 'Essais libres 1', it: 'Prove libere 1', pt: 'Treino livre 1', ar: 'التجارب الحرة الأولى' },
  SecondPractice: { tr: '2. Antrenman', en: 'Practice 2', de: '2. Freies Training', es: 'Práctica 2', fr: 'Essais libres 2', it: 'Prove libere 2', pt: 'Treino livre 2', ar: 'التجارب الحرة الثانية' },
  ThirdPractice: { tr: '3. Antrenman', en: 'Practice 3', de: '3. Freies Training', es: 'Práctica 3', fr: 'Essais libres 3', it: 'Prove libere 3', pt: 'Treino livre 3', ar: 'التجارب الحرة الثالثة' },
  SprintQualifying: { tr: 'Sprint Sıralaması', en: 'Sprint Qualifying', de: 'Sprint-Qualifying', es: 'Clasificación Sprint', fr: 'Qualifications Sprint', it: 'Qualifiche Sprint', pt: 'Classificação Sprint', ar: 'تصفيات السباق السريع' },
  Sprint: { tr: 'Sprint', en: 'Sprint', de: 'Sprint', es: 'Sprint', fr: 'Sprint', it: 'Sprint', pt: 'Sprint', ar: 'السباق السريع' },
  Qualifying: { tr: 'Sıralama', en: 'Qualifying', de: 'Qualifying', es: 'Clasificación', fr: 'Qualifications', it: 'Qualifiche', pt: 'Classificação', ar: 'التجارب التأهيلية' },
  Race: { tr: 'Yarış', en: 'Race', de: 'Rennen', es: 'Carrera', fr: 'Course', it: 'Gara', pt: 'Corrida', ar: 'السباق' },
};
// TR ve ES geçmiş dosyalardan; diğerleri sezonluk hak sahipleri
const F1_KANAL = { TR: ['beIN Sports 4'], ES: ['DAZN F1'], GB: ['Sky Sports F1'], DE: ['Sky Sport F1'], IT: ['Sky Sport F1'], FR: ['Canal+'], US: ['Apple TV'], NL: ['Viaplay'] };
const f1 = await al(`https://api.jolpi.ca/ergast/f1/${GUN.slice(0, 4)}/races/`, 'json');
let f1Ek = 0;
for (const r of f1?.MRData?.RaceTable?.Races || []) {
  const ulke = r.Circuit?.Location?.country;
  const gp = GP_AD[ulke] || hepsi(r.raceName.replace(/Grand Prix/, 'GP'));
  for (const [anahtar, ad] of Object.entries(SEANS)) {
    const s = anahtar === 'Race' ? { date: r.date, time: r.time } : r[anahtar];
    const t = s?.time && Date.parse(`${s.date}T${s.time}`);
    if (!(t >= BAS && t < SON)) continue;
    const ev = { home: ascii(`Formula 1 ${gp.tr}`), names: Object.fromEntries(DIL.map(l => [l, l === 'ar' ? `الفورمولا 1 - ${gp.ar}` : `Formula 1 ${gp[l]}`])) };
    kayit({ sport: 'motorsport', cid: 'f1', utc: new Date(t).toISOString(), ev, dep: { home: ascii(ad.tr), names: { ...ad } },
      broadcasts: { ...F1_KANAL }, sources: ['jolpi.ca'] });
    f1Ek++;
  }
}
rapor.push(`F1: ${f1 ? f1Ek + ' seans' : 'okunamadı'}`);

// ── 3) Türkiye Kupası — A Spor yayın akışı (yalnız bugünün akışı yayında) ───
if (GUN === BUGUN_TR) {
  const h = await al('https://www.aspor.com.tr/yayin-akisi');
  const satir = (h || '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.replace(/&#x131;/g, 'ı').replace(/&amp;/g, '&').trim()).filter(Boolean);
  let saat = null, adet = 0;
  for (const s of satir) {
    const t = s.match(/^([01]\d|2[0-3])[:.]([0-5]\d)$/);
    if (t) { saat = `${t[1]}:${t[2]}`; continue; }
    const z = s.match(/^Ztk\s*\/\s*(.+?)\s+-\s+(.+)$/i);
    if (!z || !saat) continue;
    const temiz = x => x.replace(/\s+A\.?\s?Ş\.?$/i, '').replace(/\b(Kktc|Fk|Sk|Fc|Bld)\b/g, k => k.toUpperCase()).trim();
    const [ev, dep] = [temiz(z[1]), temiz(z[2])];
    const utc = new Date(Date.parse(`${GUN}T${saat}:00+03:00`)).toISOString();
    // kooora'nın Arapça adı KULLANILMAZ: 28 Eki'de 4 kupa maçının 2'sinde A Spor'dan farklı rakip yazıyordu
    const E = takim(ev, null), D = takim(dep, null);
    E.names.tr = ev; D.names.tr = dep;
    kayit({ sport: 'football', cid: 'turkiye_kupasi', utc, ev: E, dep: D, broadcasts: { TR: ['A Spor'] }, sources: ['aspor.com.tr'] });
    adet++;
  }
  rapor.push(`A Spor: ${h ? `${adet} Türkiye Kupası maçı` : 'okunamadı'}`);
}

// ── 4) EuroLeague / EuroCup ──────────────────────────────────────────────────
const sezon = +GUN.slice(5, 7) >= 8 ? +GUN.slice(0, 4) : +GUN.slice(0, 4) - 1;
for (const [C, cid, bc] of [['E', 'euroleague', { TR: ['S Sport Plus'] }], ['U', 'eurocup', { TR: ['EuroLeague TV'] }]]) {
  const j = await al(`https://api-live.euroleague.net/v2/competitions/${C}/seasons/${C}${sezon}/games`, 'json');
  let adet = 0;
  for (const g of j?.data || []) {
    const t = Date.parse(g.utcDate);
    if (!(t >= BAS && t < SON)) continue;
    // sözlükte/marka tablosunda karşılığı olan adı seç ("Olympiacos Piraeus" -> "Olympiacos")
    const ad = c => [c.name, c.editorialName, c.abbreviatedName].filter(Boolean)
      .find(v => BASKET_AD[n(v)] || SOZ.takimlar[n(v)]?.sport === 'basketball') || c.name;
    kayit({ sport: 'basketball', cid, utc: g.utcDate, ev: takim(ad(g.local.club), null, 'basketball'),
      dep: takim(ad(g.road.club), null, 'basketball'), broadcasts: bc, sources: ['euroleague.net'] });
    adet++;
  }
  rapor.push(`${cid}: ${j ? adet + ' maç' : 'okunamadı'}`);
}

// ── Birleştirme ──────────────────────────────────────────────────────────────
const oku = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const mevcut = oku(OUT);
const temel = mevcut?.date === GUN ? mevcut : { date: GUN, model: 'user-provided', matches: [] };
const ayni =(a, b) => a.sport === b.sport && ortak(a.home, b.home) && ortak(a.away, b.away) &&
  Math.abs(Date.parse(a.kickoffUtc) - Date.parse(b.kickoffUtc)) <= 6 * 3600e3;
let yeniMac = 0, yeniUlke = 0;
const ekle = liste => {
  for (const m of liste) {
    const t = temel.matches.find(x => ayni(x, m));
    if (!t) { temel.matches.push(m); yeniMac++; continue; }
    for (const [cc, k] of Object.entries(m.broadcasts)) if (!t.broadcasts[cc]?.length) { t.broadcasts[cc] = k; yeniUlke++; }
  }
};
const onceki = temel.matches.length;
ekle(taze);
const kuyruk = oku(KUYRUK);
if (kuyruk?.date === GUN) ekle(kuyruk.matches);

// Temizlik (eski/elle girilmiş kayıtlar dahil): yer tutucu kanalları ve boş kalan ülke listelerini sil
let temizlenen = 0;
for (const m of temel.matches) for (const [cc, k] of Object.entries(m.broadcasts || {})) {
  const t = k.filter(x => !YER_TUTUCU.test(x));
  temizlenen += k.length - t.length;
  if (t.length) m.broadcasts[cc] = t; else delete m.broadcasts[cc];
}
if (temizlenen) rapor.push(`temizlik: ${temizlenen} yer tutucu kanal silindi`);

if (!temel.matches.length) {
  console.error(`Hiç maç bulunamadı (${GUN}) — dosyaya dokunulmadı.\n` + rapor.join('\n'));
  process.exit(1);
}
temel.matches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
const dal = {};
for (const m of temel.matches) dal[m.sport] = (dal[m.sport] || 0) + 1;
const cikti = { generated_at: new Date().toISOString().replace(/\.\d+Z$/, '.000Z'), date: GUN, model: temel.model || 'user-provided',
  stats: { ...(temel.stats || {}), total: temel.matches.length, withChannel: temel.matches.filter(x => Object.values(x.broadcasts).some(k => k.length)).length,
    bySport: dal, warnings: 0, searches: 0 },
  matches: temel.matches };
fs.writeFileSync(OUT, JSON.stringify(cikti, null, 1) + '\n');
rapor.push(`${GUN}: önceki ${onceki} maç (${mevcut?.date === GUN ? 'aynı gün, korundu' : 'yeni gün'}) · bu tur ${taze.length} · eklenen maç ${yeniMac} · eklenen ülke kaydı ${yeniUlke}${kuyruk ? ' · kuyruk dosyası işlendi' : ''} · toplam ${temel.matches.length} ${JSON.stringify(dal)}`);
console.log(rapor.join('\n'));
