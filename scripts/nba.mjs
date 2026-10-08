// NBA MACLARI + KANALLARI — matches-daily.json'a ESPN'den NBA maclarini ekler/tamamlar.
//
// Kullanici karari (8 Eki 2026): NBA yalniz TR'ye degil herkese gosterilir (tier global),
// kanal bilinmeyen ulkede kanalsiz listelenebilir. Onceden NBA yalniz TR kaynagindan
// `regional` + tek TR kanaliyla giriyordu -> ABD'li kullanici kendi ligini hic gormuyordu.
//
// Ne yapar:
//  1. ESPN'in acik mac programi (site.api.espn.com, anahtar istemez) -> dosya gununun NBA maclari.
//     Pencere: dosya gunu 00:00 TR (onceki gun 21:00 UTC) .. ertesi gun 03:00 UTC (talimat §2).
//     Bitmis maclar alinmaz.
//  2. Dosyada zaten olan NBA macini (TR kaynagindan gelmis) saat + takim adiyla bulur, yoksa ekler.
//  3. home/away = ESPN'in kisa adi ("Lakers", "Warriors"): uygulama favoriyi norm(home) ile
//     takim kimligine (lakers, warriors...) esler. "Phoenix Suns" yazilirsa favori bildirimi GITMEZ.
//  4. Kanallar: ABD = ESPN'in o maca verdigi ulusal (+ yerel) kanallar; ulusal yoksa League Pass.
//     Diger ulkeler = scripts/nba-yayincilar.json. Dosyada bir ulkenin kanali ZATEN varsa
//     (ornegin TR kaynagindan "Prime Video") ona dokunulmaz — mac bazli bilgi tablodan iyidir.
//
// Calistir (filtre.mjs'den once):  node scripts/nba.mjs [assets/matches-daily.json] [--dry]
// ESPN'e ulasilamazsa dosyaya dokunmaz, UYARI basar, cikis kodu 0 (push'u engellemez).

import fs from 'node:fs';

const args = process.argv.slice(2);
const KURU = args.includes('--dry');
const YOL = args.find(a => !a.startsWith('--')) ?? 'assets/matches-daily.json';
const TABLO = JSON.parse(fs.readFileSync(new URL('./nba-yayincilar.json', import.meta.url), 'utf8')).ulkeler;
const DILLER = ['tr', 'en', 'de', 'es', 'fr', 'it', 'pt', 'ar'];

// Arapca adlar (ESPN kisaltmasina gore). Listede olmayan takim (hazirlikta yabanci kulup) Ingilizce kalir.
const AR = {
  ATL: 'أتلانتا هوكس', BOS: 'بوسطن سيلتيكس', BKN: 'بروكلين نتس', CHA: 'شارلوت هورنتس',
  CHI: 'شيكاغو بولز', CLE: 'كليفلاند كافالييرز', DAL: 'دالاس مافريكس', DEN: 'دنفر ناجتس',
  DET: 'ديترويت بيستونز', GS: 'غولدن ستايت ووريورز', HOU: 'هيوستن روكتس', IND: 'إنديانا بيسرز',
  LAC: 'لوس أنجلوس كليبرز', LAL: 'لوس أنجلوس ليكرز', MEM: 'ممفيس غريزليز', MIA: 'ميامي هيت',
  MIL: 'ميلووكي باكس', MIN: 'مينيسوتا تمبروولفز', NO: 'نيو أورلينز بيليكانز', NY: 'نيويورك نيكس',
  OKC: 'أوكلاهوما سيتي ثاندر', ORL: 'أورلاندو ماجيك', PHI: 'فيلادلفيا سفنتي سيكسرز', PHX: 'فينيكس صنز',
  POR: 'بورتلاند ترايل بليزرز', SAC: 'ساكرامنتو كينغز', SA: 'سان أنتونيو سبيرز', TOR: 'تورونتو رابتورز',
  UTAH: 'يوتا جاز', WSH: 'واشنطن ويزاردز',
};

const TURNUVA = {
  1: { tr: 'NBA Hazırlık Maçları', en: 'NBA Preseason', de: 'NBA Preseason', es: 'Pretemporada NBA',
       fr: 'Présaison NBA', it: 'Preseason NBA', pt: 'Pré-temporada da NBA', ar: 'مباريات NBA التحضيرية' },
  2: { tr: 'NBA', en: 'NBA', de: 'NBA', es: 'NBA', fr: 'NBA', it: 'NBA', pt: 'NBA', ar: 'دوري NBA' },
  3: { tr: 'NBA Play-Off', en: 'NBA Playoffs', de: 'NBA Playoffs', es: 'Playoffs NBA',
       fr: 'Playoffs NBA', it: 'Playoff NBA', pt: 'Playoffs da NBA', ar: 'أدوار NBA الإقصائية' },
};
TURNUVA[5] = TURNUVA[3];   // play-in

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');   // uygulamadaki norm() ile ayni (22 kar. kesmesi haric)
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const espnGunu = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

const d = JSON.parse(fs.readFileSync(YOL, 'utf8'));
const gun = d.date;                                               // "2026-10-08" (TR gunu)
const bas = Date.parse(`${gun}T00:00:00+03:00`);
const son = Date.parse(`${gun}T00:00:00Z`) + 27 * 3600e3;         // ertesi gun 03:00 UTC

// ESPN'in "dates" parametresi ABD (Dogu) gunu. Pencere iki ABD gunune yayilir.
const gunler = [...new Set([bas - 12 * 3600e3, bas + 12 * 3600e3].map(espnGunu))];
let olaylar = [];
try {
  for (const g of gunler) {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${g}&limit=50`,
      { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`ESPN ${g} HTTP ${r.status}`);
    olaylar.push(...((await r.json()).events ?? []));
  }
} catch (e) {
  console.log(`UYARI: ESPN'e ulasilamadi (${e.message}) — dosyaya dokunulmadi.`);
  process.exit(0);
}

const gorulen = new Set();
olaylar = olaylar.filter(e => {
  const t = Date.parse(e.date);
  if (gorulen.has(e.id) || t < bas || t >= son) return false;
  gorulen.add(e.id);
  return !e.status?.type?.completed;
});

// Dosyadaki NBA kaydi bu ESPN macina mi ait? Saat 3 saat icinde + iki takimin kisa adi kayitta geciyor.
function eslesen(takimlar, t) {
  return d.matches.find(m => {
    if (m.sport !== 'basketball' || !/nba/i.test(m.competitionId ?? '')) return false;
    if (Math.abs(Date.parse(m.kickoffUtc) - t) > 3 * 3600e3) return false;
    const kayit = [norm(m.home), norm(m.away), norm(m.homeNames?.en), norm(m.awayNames?.en)].join('|');
    return takimlar.every(tk => kayit.includes(norm(tk.shortDisplayName)) || kayit.includes(norm(tk.displayName)));
  });
}

let eklenen = 0, guncellenen = 0;
const rapor = [];
for (const e of olaylar) {
  const c = e.competitions?.[0];
  const ev = c?.competitors?.find(x => x.homeAway === 'home')?.team;
  const dep = c?.competitors?.find(x => x.homeAway === 'away')?.team;
  if (!ev || !dep) continue;
  const t = Date.parse(e.date);
  const kickoffUtc = new Date(t).toISOString().replace('.000Z', 'Z');

  const ulusal = (c.broadcasts ?? []).filter(b => b.market === 'national').flatMap(b => b.names);
  const yerel  = (c.broadcasts ?? []).filter(b => b.market !== 'national').flatMap(b => b.names);
  const abd = [...new Set([...ulusal, ...yerel, ...(ulusal.length ? [] : ['NBA League Pass'])])];

  const adlar = tk => Object.fromEntries(DILLER.map(l => [l, l === 'ar' ? (AR[tk.abbreviation] ?? tk.displayName) : tk.displayName]));
  let m = eslesen([ev, dep], t);
  if (m) {
    guncellenen++;
  } else {
    m = {
      id: `basketball-${kickoffUtc.slice(0, 10).replace(/-/g, '')}-${slug(ev.shortDisplayName)}-${slug(dep.shortDisplayName)}`,
      sport: 'basketball', competitionId: 'nba', tier: 'global',
      competition: TURNUVA[e.season?.type] ?? TURNUVA[2],
      home: '', away: '', homeNames: {}, awayNames: {}, kickoffUtc, broadcasts: {}, sources: [],
    };
    d.matches.push(m);
    eklenen++;
  }
  m.tier = 'global';
  m.competitionId = 'nba';
  if (DILLER.some(l => !m.competition?.[l])) m.competition = TURNUVA[e.season?.type] ?? TURNUVA[2];
  m.home = ev.shortDisplayName;
  m.away = dep.shortDisplayName;
  // Eski kaydin Arapca adi YALNIZ tabloda olmayan takimda korunur: TR kaynagi ev/deplasmani
  // ters yazmissa eski ad yanlis takima gider.
  const eskiAr = (tk, eski) => (!AR[tk.abbreviation] && eski?.ar ? { ar: eski.ar } : {});
  m.homeNames = { ...adlar(ev), ...eskiAr(ev, m.homeNames) };
  m.awayNames = { ...adlar(dep), ...eskiAr(dep, m.awayNames) };
  m.broadcasts ??= {};
  if (!m.broadcasts.US?.length) m.broadcasts.US = abd;
  for (const [ulke, kanallar] of Object.entries(TABLO)) {
    if (!m.broadcasts[ulke]?.length && kanallar.length) m.broadcasts[ulke] = [...kanallar];
  }
  m.sources = [...new Set([...(m.sources ?? []), 'espn'])];
  rapor.push(`${kickoffUtc.slice(11, 16)}Z ${dep.shortDisplayName} @ ${ev.shortDisplayName} | ABD: ${m.broadcasts.US.join(', ')}`);
}

console.log(`NBA (ESPN): penceredeki ${olaylar.length} mac · ${eklenen} eklendi · ${guncellenen} dosyada vardi, tamamlandi`);
rapor.forEach(r => console.log('  ' + r));

if (!eklenen && !guncellenen) { console.log('Dosyaya dokunulmadi.'); process.exit(0); }

d.matches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
if (d.stats) {
  d.stats.total = d.matches.length;
  d.stats.withChannel = d.matches.filter(x => Object.values(x.broadcasts ?? {}).some(k => k.length)).length;
  d.stats.bySport = d.matches.reduce((o, x) => (o[x.sport] = (o[x.sport] ?? 0) + 1, o), {});
}
if (KURU) { console.log('--dry: dosya yazilmadi.'); process.exit(0); }
fs.writeFileSync(YOL, JSON.stringify(d, null, 1) + '\n');   // dosyanin kendi bicimi: 1 bosluk girinti
console.log(`yazildi: ${YOL} (${d.matches.length} mac)`);
