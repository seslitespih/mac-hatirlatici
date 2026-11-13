#!/usr/bin/env node
// OTOMATİK FİKSTÜR — yapay zekâ / API kredisi KULLANMAZ (28 Eki 2026).
// GitHub Actions `auto-fixtures.yml` günde 4 kez çalıştırır; Claude limiti bitse de, bilgisayar kapalı olsa da sürer.
//
// Kaynaklar (hepsi açık sayfa, anahtar gerekmez):
//   futbol + kanallar  FotMob ülke TV rehberleri  fotmob.com/en/tv-guide/<ülke>  (UTC saat, 33 ülke)
//   MENA kanal + Arapça ad  kooora  .../مباريات-اليوم?date=YYYY-MM-DD
//   TR kanalları + Türkiye Kupası, BSL, voleybol, MotoGP  sporekrani.com (yalnız bugün)
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
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/ß/g, 'ss')
  // NFD ile ayrışmayan harfler (Lehçe ł, Balkan đ, İskandinav æ): "Wrocław" -> "Wroc-aw" id'si çıkıyordu
  .replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
  .replace(/œ/g, 'oe').replace(/Ø/g, 'O').replace(/þ/g, 'th');
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
  57: 'eredivisie', 48: 'championship', 108: 'league_one', 8972: 'usl', 38: 'aut_bundesliga', 441: 'ukr_pl', 530: 'botola',
  40: 'belgian_pl', 59: 'eliteserien', 252: 'hnl', 122: 'czech_fl', 69: 'swiss_sl', 196: 'ekstraklasa' };
// Avrupa yerel ligleri (kullanıcı, 2 Kas 2026): maç YALNIZ o ülkenin kullanıcısına görünür — kanal listesinde yalnız o ülke kalır.
// FotMob o ülkenin rehberinde kanal verirse o kullanılır; yoksa `kanal` = ligin sezonluk yayıncısı (TAHMİN, maç bazında
// doğrulanmadı — o ülkede FotMob rehberi yok: GR, PL, RO, UA, HU, RS). `dil`/`ad`: lig adının o ülkenin dilindeki hâli.
const YEREL = {
  eredivisie: { ulke: ['NL'], kanal: ['ESPN'], dil: 'nl', ad: 'Eredivisie' },
  belgian_pl: { ulke: ['BE'], kanal: ['DAZN'], dil: 'nl', ad: 'Jupiler Pro League' },
  eliteserien: { ulke: ['NO'], kanal: ['TV 2 Play'], dil: 'nb', ad: 'Eliteserien' },
  hnl: { ulke: ['HR'], kanal: ['MAXtv'], dil: 'hr', ad: 'SuperSport HNL' },
  czech_fl: { ulke: ['CZ'], kanal: ['Oneplay Sport'], dil: 'cs', ad: 'Chance Liga' },
  aut_bundesliga: { ulke: ['AT'], kanal: ['Sky Sport Austria'], dil: 'de', ad: 'Admiral Bundesliga' },
  swiss_sl: { ulke: ['CH'], kanal: ['blue Sport'], dil: 'de', ad: 'Super League' },
  greek_sl: { ulke: ['GR'], kanal: ['Cosmote Sport', 'Nova Sports'], dil: 'el', ad: 'Super League Ελλάδας' },
  ekstraklasa: { ulke: ['PL'], kanal: ['Canal+ Sport'], dil: 'pl', ad: 'PKO BP Ekstraklasa' },
  ro_liga1: { ulke: ['RO'], kanal: ['Digi Sport', 'Prima Sport'], dil: 'ro', ad: 'SuperLiga' },
  ukr_pl: { ulke: ['UA'], kanal: ['Setanta Sports'], dil: 'uk', ad: "Українська Прем'єр-ліга" },
  hu_nb1: { ulke: ['HU'], kanal: ['M4 Sport'], dil: 'hu', ad: 'NB I' },
  rs_superliga: { ulke: ['RS'], kanal: ['Arena Sport'], dil: 'sr', ad: 'Superliga Srbije' },
};
// Kimliğinden emin olunmayanlar ada göre (ülke kodu | FotMob lig adı)
const LIG_AD = { 'POR|Taça de Portugal': 'taca_portugal', 'TUR|Turkish Cup': 'turkiye_kupasi', 'AZE|Premier League': 'aze_pl',
  'INT|Copa Libertadores': 'libertadores', 'INT|Copa Sudamericana': 'sudamericana', 'INT|Europa League': 'europa',
  'INT|Conference League': 'conference', 'INT|Friendlies': 'friendly', 'INT|UEFA Nations League A': 'uefa_nations',
  'INT|UEFA Nations League B': 'uefa_nations', 'INT|UEFA Nations League C': 'uefa_nations', 'INT|UEFA Nations League D': 'uefa_nations',
  'INT|World Cup Qualification UEFA': 'wc_qual_uefa', 'INT|World Cup Qualification CONMEBOL': 'wc_qual_conmebol' };
// Milli turnuvalar FotMob'da grup ekiyle gelir ("UEFA Nations League A Grp. 2") — tam ad tutmuyordu, maç fm_9806 kimliğiyle,
// İngilizce adla ve "regional" girdi (milli ara, 13 Kas 2026). Ada göre, grup eki önemsiz.
const LIG_RE = [[/^UEFA Nations League [A-D]\b/i, 'uefa_nations'], [/^Africa Cup of Nations Qualification/i, 'afcon_qual'],
  [/^CONCACAF Nations League/i, 'concacaf_nl'], [/^World Cup Qualification UEFA/i, 'wc_qual_uefa'],
  [/^World Cup Qualification CONMEBOL/i, 'wc_qual_conmebol']];
const ligAdla = (cc, lig) => LIG_AD[`${cc}|${lig}`] || LIG_RE.find(([re]) => re.test(lig || ''))?.[1];
// Milli maçlarda FotMob'un TR rehberi yanlış: Uluslar Ligi'nin hepsine "S Sport" yazıyor, oysa 2026-27'de yayın ATV grubunda
// (A Spor / A Haber / A Para / ATV), bir kısmı S Sport Plus'ta, çoğu "Yayın Yok" (sporekrani, 13 Kas 2026).
// Bu turnuvalarda TR kanalını YALNIZ sporekrani yazar (maç günü); FotMob'un TR'si atılır.
const MILLI_TR = new Set(['uefa_nations', 'wc_qual_uefa']);
const TR_MILLI_TABAN = ['ATV'];   // Türkiye'nin kendi maçı, sporekrani okunamazsa (Türkiye-Belçika 12 Kas: ATV)
// Cezayir milli maçı: beIN (kooora maç günü verir) + Cezayir devlet TV'si (Cezayir-Togo 14 Kas: beIN Sports 1 + Algerian TV, dzsport-live)
const DZ_MILLI = ['ENTV'];
const cezayirMi = t => n(t) === 'algeria';
// FotMob ülke rehberine komşu ülke kanalı / radyo karışıyor (13 Kas: FR'de Alman "RTL Television", AT'de radyo "NDR info")
const YABANCI_KANAL = { FR: /^RTL Television/i, AT: /^NDR info/i, US: /\(Canada\)$/i };
const YENI_LIG = {
  copa_del_rey: ['regional', { tr: 'İspanya Kral Kupası', en: 'Copa del Rey', de: 'Copa del Rey', es: 'Copa del Rey', fr: 'Coupe du Roi', it: 'Coppa del Re', pt: 'Copa do Rei', ar: 'كأس ملك إسبانيا' }],
  taca_da_liga: ['regional', { tr: 'Portekiz Lig Kupası', en: 'Taça da Liga', de: 'Taça da Liga', es: 'Copa de la Liga de Portugal', fr: 'Coupe de la Ligue portugaise', it: 'Taça da Liga', pt: 'Taça da Liga', ar: 'كأس الدوري البرتغالي' }],
  fa_cup: ['global', { tr: 'İngiltere FA Cup', en: 'FA Cup', de: 'FA Cup', es: 'FA Cup', fr: 'FA Cup', it: 'FA Cup', pt: 'FA Cup', ar: 'كأس الاتحاد الإنجليزي' }],
  coupe_de_france: ['regional', { tr: 'Fransa Kupası', en: 'Coupe de France', de: 'Coupe de France', es: 'Copa de Francia', fr: 'Coupe de France', it: 'Coppa di Francia', pt: 'Taça de França', ar: 'كأس فرنسا' }],
  alg_l1: ['regional', { tr: 'Cezayir Ligue 1', en: 'Algerian Ligue 1', de: 'Algerische Ligue 1', es: 'Liga de Argelia', fr: 'Ligue 1 Mobilis', it: 'Ligue 1 algerina', pt: 'Liga Argelina', ar: 'الرابطة الجزائرية المحترفة الأولى' }],
  alg_cup: ['regional', { tr: 'Cezayir Kupası', en: 'Algerian Cup', de: 'Algerischer Pokal', es: 'Copa de Argelia', fr: "Coupe d'Algérie", it: "Coppa d'Algeria", pt: 'Taça da Argélia', ar: 'كأس الجزائر' }],
  belgian_pl: ['regional', { tr: 'Belçika Pro Lig', en: 'Belgian Pro League', de: 'Belgische Pro League', es: 'Liga de Bélgica', fr: 'Jupiler Pro League', it: 'Pro League belga', pt: 'Liga Belga', ar: 'الدوري البلجيكي' }],
  eliteserien: ['regional', { tr: 'Norveç Eliteserien', en: 'Eliteserien', de: 'Eliteserien', es: 'Eliteserien', fr: 'Eliteserien', it: 'Eliteserien', pt: 'Eliteserien', ar: 'الدوري النرويجي' }],
  hnl: ['regional', { tr: 'Hırvatistan HNL', en: 'Croatian HNL', de: 'Kroatische HNL', es: 'HNL de Croacia', fr: 'HNL croate', it: 'HNL croata', pt: 'HNL da Croácia', ar: 'الدوري الكرواتي' }],
  czech_fl: ['regional', { tr: 'Çekya 1. Lig', en: 'Czech First League', de: 'Tschechische 1. Liga', es: 'Primera Liga Checa', fr: 'Championnat tchèque', it: 'Prima Lega ceca', pt: 'Liga Checa', ar: 'الدوري التشيكي' }],
  swiss_sl: ['regional', { tr: 'İsviçre Süper Ligi', en: 'Swiss Super League', de: 'Super League', es: 'Superliga Suiza', fr: 'Super League suisse', it: 'Super League svizzera', pt: 'Superliga Suíça', ar: 'الدوري السويسري' }],
  greek_sl: ['regional', { tr: 'Yunanistan Süper Ligi', en: 'Greek Super League', de: 'Griechische Super League', es: 'Superliga de Grecia', fr: 'Super League grecque', it: 'Super League greca', pt: 'Superliga Grega', ar: 'الدوري اليوناني' }],
  ekstraklasa: ['regional', { tr: 'Polonya Ekstraklasa', en: 'Ekstraklasa', de: 'Ekstraklasa', es: 'Ekstraklasa', fr: 'Ekstraklasa', it: 'Ekstraklasa', pt: 'Ekstraklasa', ar: 'الدوري البولندي' }],
  ro_liga1: ['regional', { tr: 'Romanya SuperLiga', en: 'Romanian SuperLiga', de: 'Rumänische SuperLiga', es: 'SuperLiga de Rumanía', fr: 'SuperLiga roumaine', it: 'SuperLiga rumena', pt: 'SuperLiga Romena', ar: 'الدوري الروماني' }],
  hu_nb1: ['regional', { tr: 'Macaristan NB I', en: 'Hungarian NB I', de: 'Ungarische NB I', es: 'NB I de Hungría', fr: 'NB I hongroise', it: 'NB I ungherese', pt: 'NB I da Hungria', ar: 'الدوري المجري' }],
  rs_superliga: ['regional', { tr: 'Sırbistan SuperLiga', en: 'Serbian SuperLiga', de: 'Serbische SuperLiga', es: 'SuperLiga de Serbia', fr: 'SuperLiga serbe', it: 'SuperLiga serba', pt: 'SuperLiga Sérvia', ar: 'الدوري الصربي' }],
  eurocup_women: ['regional', { tr: 'Kadınlar EuroCup', en: 'EuroCup Women', de: 'EuroCup Women', es: 'EuroCup Femenina', fr: 'EuroCoupe féminine', it: 'EuroCup femminile', pt: 'EuroCup Feminina', ar: 'كأس أوروبا لكرة السلة للسيدات' }],
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

// futbol dışında turnuva da aynı olmalı: "Moto2 Malezya GP - Sıralama" ile "MotoGP Malezya GP - ... Sıralama" birleşiyordu
const ayni = (a, b) => a.sport === b.sport && (a.sport === 'football' || a.competitionId === b.competitionId) &&
  ortak(a.home, b.home) && ortak(a.away, b.away) &&
  // motorsporda seanslar aynı gün ardışık: "1. Antrenman" ile "2. Antrenman" 3,5 saat arayla birleşiyordu
  Math.abs(Date.parse(a.kickoffUtc) - Date.parse(b.kickoffUtc)) <= (a.sport === 'motorsport' ? 30 * 60e3 : 6 * 3600e3);

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
  let cid = LIG[m.lid] || ligAdla(m.cc, m.lig);
  if ((!cid || cid === 'concacaf_nl') && !appMaci) continue;        // altın kural: uygulama takımı oynuyorsa lig ne olursa girer
                                                                    // (CONCACAF'ta Montserrat-Nikaragua gibi maçlar liste kalabalığı)
  cid ||= `fm_${m.lid}`;
  if (KALABALIK_KUPA.has(cid) && !appMaci && Object.keys(m.kanal).length < 2) continue;
  const koo = kooBul(m.utc, m.home, m.away);
  const broadcasts = { ...m.kanal };
  if (MILLI_TR.has(cid)) {
    delete broadcasts.TR;
    if ([m.home, m.away].some(t => /^(turkey|turkiye)$/.test(n(t)))) broadcasts.TR = TR_MILLI_TABAN;
  }
  const mk = menaKanal(koo?.tv);
  if (mk.length) for (const cc of MENA_ULKE) { const k = mk.filter(x => !/alkass/i.test(x) || cc === 'QA'); if (k.length) broadcasts[cc] = k; }
  // Cezayir milli maçı Cezayir'de devlet TV'sinde de (EPTV/ENTV) — menaKanal yalnız beIN/TOD/AD alıyor, Cezayir kanalı düşüyordu
  if ([m.home, m.away].some(cezayirMi)) broadcasts.DZ = [...new Set([...(broadcasts.DZ || []), ...DZ_MILLI])].slice(0, 4);
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
  // Avrupa yerel ligleri (kanal YEREL tablosundan; kooora'nın kanal listesi bu liglerde yabancı kanallardan ibaret)
  'الدوري الهولندي': { cid: 'eredivisie' }, 'الدوري البلجيكي': { cid: 'belgian_pl' }, 'الدوري النرويجي الممتاز': { cid: 'eliteserien' },
  'الدوري الكرواتي': { cid: 'hnl' }, 'الدوري التشيكي': { cid: 'czech_fl' }, 'الدوري التشيكي الممتاز': { cid: 'czech_fl' },
  'الدوري النمساوي الممتاز': { cid: 'aut_bundesliga' }, 'دوري السوبر السويسري': { cid: 'swiss_sl' }, 'دوري السوبر اليوناني': { cid: 'greek_sl' },
  'الدوري البولندي الممتاز': { cid: 'ekstraklasa' }, 'الدوري الروماني': { cid: 'ro_liga1' }, 'الدوري الأوكراني الممتاز': { cid: 'ukr_pl' },
  'الدوري المجري': { cid: 'hu_nb1' }, 'الدوري الصربي': { cid: 'rs_superliga' },
};
let kooEk = 0;
for (const k of kooora) {
  const L = KOO_LIG[k.comp];
  const t = Date.parse(k.start);
  if (!L || !(t >= BAS && t < SON) || kooKullanildi.has(k.id) || !k.enHome) continue;
  if (taze.some(m => Math.abs(Date.parse(m.kickoffUtc) - t) <= 3 * 3600e3 && ortak(m.home, k.enHome) && ortak(m.away, k.enAway))) continue;
  const Y = YEREL[L.cid];
  const tv = Y ? [] : temizKanal(k.tv), mena = Y ? [] : menaKanal(k.tv);
  const broadcasts = { ...(L.sabit || {}), ...(Y ? { [Y.ulke[0]]: Y.kanal } : {}) };
  if (tv.length) for (const cc of L.ulke || []) broadcasts[cc] = tv;
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

// ── 5) sporekrani.com — Türkiye TV programı (hangikanalda'nın yerine, kullanıcı önerisi 31 Eki) ──
// Açık ana sayfa yalnız BUGÜNÜ verir (diğer günler yetkili API'den, onu kullanmıyoruz) — bot günde 4 tur zaten.
// Çok gereksiz satır var (TV programları, tenis, alt ligler): yalnız aşağıdaki ligler alınır.
const SE_LIG = [
  [/^Basketbol Süper Ligi/i, 'bsl', 'basketball'], [/^Kad[ıi]nlar Basketbol Süper Ligi/i, 'kbsl', 'basketball', 'kadin'],
  // kadın kalıpları ÖNCE: site "Eurocup Kadinlar" yazıyor, yoksa erkek EuroCup'a düşer (2 Kas)
  [/EuroLeague Kad|Kad[ıi]nlar EuroLeague/i, 'euroleague_women', 'basketball', 'kadin'], [/EuroCup Kad|Kad[ıi]nlar EuroCup/i, 'eurocup_women', 'basketball', 'kadin'],
  [/EuroLeague|THY Avrupa Ligi/i, 'euroleague', 'basketball'],
  [/EuroCup/i, 'eurocup', 'basketball'], [/^İspanya Basketbol Ligi/i, 'acb', 'basketball'], [/FIBA Şampiyonlar Ligi/i, 'fiba_cl', 'basketball'],
  [/^TVF Efeler Ligi/i, 'efeler', 'volleyball'], [/^TVF Sultanlar Ligi/i, 'sultansliga', 'volleyball', 'kadin'],
  [/^MotoGP /i, 'motogp', 'motorsport'], [/^Moto2 /i, 'moto2', 'motorsport'], [/^Moto3 /i, 'moto3', 'motorsport'],
  [/^Formula 2 /i, 'f2', 'motorsport'], [/^Formula 3 /i, 'f3', 'motorsport'],
  [/^Trendyol Süper Lig/i, 'superlig', 'football'], [/^Trendyol 1\. Lig/i, 'tff1', 'football'], [/Türkiye Kupas/i, 'turkiye_kupasi', 'football'],
  // milli ara (13 Kas 2026): Uluslar Ligi'nin TR kanalı yalnız buradan; "Yayın Yok" = TR'de kanal yok. Kadınlar/U21 ayrı ad taşır, eşleşmez.
  [/^UEFA Uluslar Ligi/i, 'uefa_nations', 'football'],
];
// Türkçe ülke adı -> FotMob'daki İngilizce ad ("Sırbistan" -> "Serbia"); yoksa milli maç Türkçe adla İKİNCİ kayıt olurdu
const TR_ULKE = {};
for (const v of Object.values(SOZ.takimlar)) if (v.sport === 'football' && v.names?.tr) TR_ULKE[n(v.names.tr)] ??= v.home;
const APP_TAKIM = TAKIM_SATIR.map(l => ({ id: l.match(/id: '([^']+)'/)[1], ad: (l.match(/name: +'([^']+)'/) || [])[1],
  spor: (l.match(/sport: '([^']+)'/) || [])[1] || 'football' }));
// "Ç.Rizespor", "RAMS Başakşehir", "Eczacıbaşı Dynavit" -> uygulamanın kimliğiyle tutan ad
function trAd(ad, spor, kadin) {
  const k = n(ad);
  const app = APP_TAKIM.find(t => t.spor === spor && t.id.length >= 6 && (k === t.id || k.endsWith(t.id) || k.startsWith(t.id)));
  if (app && !kadin) return spor === 'football' ? (SOZ.takimlar[app.id]?.home || app.ad || ad) : (app.ad || ad);
  if (spor === 'basketball' && !kadin && BASKET_AD[k]) return BASKET_AD[k];      // Beşiktaş -> Beşiktaş GAIN
  // futbol favorisine basketbol/voleybol bildirimi gitmesin (talimat §3)
  if (spor !== 'football' && APP_FUTBOL.has(k)) return `${ad} ${spor === 'volleyball' ? 'Voleybol' : 'Basket'}${kadin ? ' Kadın' : ''}`;
  return ad;
}
const GP_TR = { Malezya: ['Malaysian GP', 'Malaysia-GP', 'GP de Malasia', 'GP de Malaisie', 'GP della Malesia', 'GP da Malásia', 'جائزة ماليزيا'],
  Portekiz: ['Portuguese GP', 'Portugal-GP', 'GP de Portugal', 'GP du Portugal', 'GP del Portogallo', 'GP de Portugal', 'جائزة البرتغال'],
  Valensiya: ['Valencia GP', 'Valencia-GP', 'GP de la Comunitat Valenciana', 'GP de Valence', 'GP di Valencia', 'GP de Valência', 'جائزة فالنسيا'],
  Katar: ['Qatar GP', 'Katar-GP', 'GP de Catar', 'GP du Qatar', 'GP del Qatar', 'GP do Catar', 'جائزة قطر'],
  Tayland: ['Thai GP', 'Thailand-GP', 'GP de Tailandia', 'GP de Thaïlande', 'GP di Thailandia', 'GP da Tailândia', 'جائزة تايلاند'] };
const SEANS_TR = [   // sıra önemli: uzun ifade önce
  [/Serbest Antrenman|Antrenman Turlar[ıi]-?/gi, ['Free Practice ', 'Freies Training ', 'Entrenamientos libres ', 'Essais libres ', 'Prove libere ', 'Treino livre ', 'التجارب الحرة ']],
  [/S[ıi]ralama Turlar[ıi]|S[ıi]ralama/gi, ['Qualifying', 'Qualifying', 'Clasificación', 'Qualifications', 'Qualifiche', 'Classificação', 'التجارب التأهيلية']],
  [/Sprint Yar[ıi]ş(lar)?[ıi]?/gi, ['Sprint', 'Sprint', 'Sprint', 'Sprint', 'Sprint', 'Sprint', 'السباق السريع']],
  [/Is[ıi]nma Turlar[ıi]/gi, ['Warm Up', 'Warm-up', 'Calentamiento', 'Warm-up', 'Warm-up', 'Aquecimento', 'الإحماء']],
  [/Yar[ıi]ş(lar)?[ıi]?/gi, ['Race', 'Rennen', 'Carrera', 'Course', 'Gara', 'Corrida', 'السباق']],
  [/\s+ve\s+/gi, [' & ', ' & ', ' y ', ' et ', ' e ', ' e ', ' و ']],
];
const cevir = (tr, i) => SEANS_TR.reduce((s, [re, k]) => s.replace(re, k[i]), tr).replace(/\s+/g, ' ').trim();
let seEk = 0, seTR = 0;
const trOtorite = [];   // { m, kanal } — kanal [] = sporekrani "Yayın Yok" dedi
if (GUN === BUGUN_TR) {
  let h = await al('https://www.sporekrani.com/');
  // sayfa başlığı günü taşır ("2026-11-02 Spor Ekranı"); gece yarısı geçişinde dünkü sayfa gelirse saatler yanlış güne yazılır
  const seGun = (h || '').match(/"title":"(\d{4}-\d\d-\d\d) Spor Ekran/)?.[1];
  if (h && seGun !== GUN) { rapor.push(`sporekrani: sayfa ${seGun || '?'} gününü gösteriyor, ${GUN} değil — atlandı`); h = null; }
  const dec = s => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  for (const r of (h || '').split('event-list__row ').slice(1)) {
    const g = re => (r.match(re) || [])[1];
    const saat = g(/event-list__time[^>]*>\s*([0-2]\d:[0-5]\d)\s*</), ad = dec(g(/event-list__name[^>]*>([^<]+)</) || ''), lig = dec(g(/event-list__league[^>]*>([^<]+)</) || '');
    const L = SE_LIG.find(([re]) => re.test(lig));
    if (!saat || !L) continue;
    const [, cid, spor, kadin] = L;
    const ham = [...(r.split('event-list__channels flex gt-xs')[1] || '').matchAll(/alt="([^"]+)"/g)].map(m => dec(m[1]).replace(/Yildiz/, 'Yıldız'));
    const yayinYok = ham.some(x => /^Yay[ıi]n Yok$/i.test(x));
    const kanal = temizKanal(ham.filter(x => !/^Yay[ıi]n Yok$/i.test(x)));
    if (!kanal.length && !(yayinYok && MILLI_TR.has(cid))) continue;
    const utc = new Date(Date.parse(`${GUN}T${saat}:00+03:00`)).toISOString();
    let ev, dep;
    if (spor === 'motorsport') {
      const gp = lig.replace(/^(MotoGP|Moto2|Moto3|Formula [23])\s+/i, '').replace(/\s*GP$/i, '').trim();
      const seri = lig.match(/^(MotoGP|Moto2|Moto3|Formula [23])/i)[1];
      const gpDil = GP_TR[gp];
      ev = { home: ascii(lig), names: Object.fromEntries(DIL.map((l, i) => [l, l === 'tr' ? lig : gpDil ? (l === 'ar' ? `${seri} - ${gpDil[6]}` : `${seri} ${gpDil[i - 1]}`) : lig])) };
      dep = { home: ascii(ad), names: Object.fromEntries(DIL.map((l, i) => [l, l === 'tr' ? ad : cevir(ad, i - 1)])) };
    } else {
      const [a, b] = ad.split(/\s+-\s+/);
      if (!a || !b) continue;
      const en = x => MILLI_TR.has(cid) ? TR_ULKE[n(x)] || x : x;
      ev = takim(trAd(en(a), spor, kadin), null, spor); dep = takim(trAd(en(b), spor, kadin), null, spor);
      ev.names.tr = a; dep.names.tr = b;
    }
    const m = { sport: spor, competitionId: cid, kickoffUtc: utc.replace('.000Z', 'Z'), home: ev.home, away: dep.home };
    const var_ = taze.find(x => ayni(x, m) || (x.competitionId === cid && x.kickoffUtc === m.kickoffUtc && (ortak(x.home, m.home) || ortak(x.away, m.away))));
    // TR kanalında yerli kaynak otorite (talimat §2.6) — birleştirmede dosyadaki eski TR'nin de ÜSTÜNE yazılır (aşağıda)
    trOtorite.push({ m: var_ || m, kanal });
    if (var_) { if (kanal.length) var_.broadcasts.TR = kanal; else delete var_.broadcasts.TR; seTR++; continue; }
    if (!kanal.length || MILLI_TR.has(cid)) continue;                 // milli maç: Türkçe adla ikinci kayıt açılmaz
    kayit({ sport: spor, cid, utc, ev, dep, broadcasts: { TR: kanal }, sources: ['sporekrani.com'] });
    seEk++;
  }
  rapor.push(`sporekrani: ${h ? `${seEk} yeni kayıt, ${seTR} kayda TR kanalı` : 'okunamadı'}`);
}

// ── Birleştirme ──────────────────────────────────────────────────────────────
const oku = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const mevcut = oku(OUT);
const temel = mevcut?.date === GUN ? mevcut : { date: GUN, model: 'user-provided', matches: [] };
let yeniMac = 0, yeniUlke = 0;
const ekle = liste => {
  for (const m of liste) {
    const t = temel.matches.find(x => ayni(x, m));
    if (!t) { temel.matches.push(m); yeniMac++; continue; }
    for (const [cc, k] of Object.entries(m.broadcasts)) if (!t.broadcasts[cc]?.length) { t.broadcasts[cc] = k; yeniUlke++; }
    // Cezayir milli maçı: gece turunda kooora boş gelir (yalnız ENTV yazılır) — gündüz turunun beIN kanalı da eklenir
    else if (cc === 'DZ' && [t.home, t.away].some(cezayirMi)) t.broadcasts.DZ = [...new Set([...k, ...t.broadcasts.DZ])].slice(0, 4);
  }
};
const onceki = temel.matches.length;
ekle(taze);
const kuyruk = oku(KUYRUK);
if (kuyruk?.date === GUN) ekle(kuyruk.matches);

// Eski kayıtlar: grup ekli FotMob adıyla "fm_<id>" kimliği almış milli turnuvalar (ör. fm_9806) doğru kimliğe/ada çekilir
let kimlikDuz = 0;
for (const m of temel.matches) {
  if (!/^fm_\d+$/.test(m.competitionId || '')) continue;
  const cid = ligAdla('INT', m.competition?.en);
  if (!cid) continue;
  const lb = ligBilgi(cid, m.competition.en);
  Object.assign(m, { competitionId: cid, tier: lb.tier, competition: lb.names });
  kimlikDuz++;
}
if (kimlikDuz) rapor.push(`turnuva kimliği düzeltildi: ${kimlikDuz} maç`);
// Milli turnuvada dosyada kalmış FotMob TR'si (ör. hepsine "S Sport") — Türkiye'nin maçı dışında silinir; sporekrani aşağıda yazar
for (const m of temel.matches) {
  if (!MILLI_TR.has(m.competitionId) || !m.broadcasts?.TR) continue;
  if ([m.home, m.away].some(t => /^(turkey|turkiye)$/.test(n(t)))) continue;
  if (!(m.sources || []).includes('sporekrani.com')) delete m.broadcasts.TR;
}
// TR'de yerli kaynak (sporekrani) otorite: dosyadaki eski TR kanalının ÜSTÜNE yazılır; "Yayın Yok" ise TR silinir
let trYaz = 0;
for (const { m, kanal } of trOtorite) {
  const t = temel.matches.find(x => x === m || ayni(x, m));
  if (!t) continue;
  if (kanal.length) t.broadcasts.TR = kanal; else delete t.broadcasts.TR;
  if (MILLI_TR.has(t.competitionId) && !(t.sources || []).includes('sporekrani.com')) t.sources = [...(t.sources || []), 'sporekrani.com'];
  trYaz++;
}
if (trOtorite.length) rapor.push(`sporekrani TR otoritesi: ${trYaz}/${trOtorite.length} kayda yazıldı`);

// Taban hak tablosu (talimat §2.4): günlük kaynağı olmayan ülkeye turnuvanın sezonluk yayıncısı yazılır.
// Yalnız BOŞ ülkeyi doldurur, günlük kaynağa dokunmaz; yalnız "dogrulandi" turnuvalar ("tahmin" olanlar değil).
// Cezayir + Ortadoğu (@MENA) büyük Avrupa maçlarında böyle gelir (kullanıcı, 2 Kas 2026).
const HAK = oku(path.join(KOK, 'scripts', 'broadcast-rights.json'));
let tabanEk = 0;
for (const m of temel.matches) {
  const T = HAK?.turnuvalar?.[m.competitionId];
  if (T?.durum !== 'dogrulandi') continue;
  for (const [k, kanal] of Object.entries(T.ulkeler || {})) {
    if (!Array.isArray(kanal) || !kanal.length) continue;
    const ulkeler = k.startsWith('@') ? HAK.bolgeler?.[k.slice(1)] || [] : [k];
    for (const cc of ulkeler) if (/^[A-Z]{2}$/.test(cc) && !m.broadcasts[cc]?.length) { m.broadcasts[cc] = kanal.slice(0, 4); tabanEk++; }
  }
}
rapor.push(`taban hak tablosu: ${tabanEk} boş ülkeye sezonluk yayıncı yazıldı`);

// Avrupa yerel ligleri: yalnız kendi ülkesinin kanalı kalır (Yunan ligi yalnız Yunan kullanıcıya) + lig adı yerel dilde.
// Uygulama takımı oynuyorsa dokunma (altın kural: favorisi olan her ülkeden kullanıcı görmeli).
let yerelSayi = 0;
for (const m of temel.matches) {
  const Y = YEREL[m.competitionId];
  if (!Y) continue;
  if ([m.home, m.away].some(t => APP.has(n(t)))) continue;
  const yeni = {};
  for (const cc of Y.ulke) yeni[cc] = m.broadcasts[cc]?.length ? m.broadcasts[cc] : Y.kanal;
  m.broadcasts = yeni;
  m.tier = 'regional';
  m.competition = { ...m.competition, [Y.dil]: m.competition?.[Y.dil] && Y.dil === 'de' ? m.competition[Y.dil] : Y.ad };
  yerelSayi++;
}
rapor.push(`Avrupa yerel ligleri: ${yerelSayi} maç yalnız kendi ülkesine`);

// Temizlik (eski/elle girilmiş kayıtlar dahil): yer tutucu kanalları ve boş kalan ülke listelerini sil
let temizlenen = 0;
for (const m of temel.matches) for (const [cc, k] of Object.entries(m.broadcasts || {})) {
  const t = k.filter(x => !YER_TUTUCU.test(x) && !YABANCI_KANAL[cc]?.test(x));
  temizlenen += k.length - t.length;
  if (t.length) m.broadcasts[cc] = t; else delete m.broadcasts[cc];
}
if (temizlenen) rapor.push(`temizlik: ${temizlenen} yer tutucu / yabancı kanal silindi`);

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
