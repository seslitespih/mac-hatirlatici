// KADIN FUTBOLU + U21 FİLTRESİ — matches-daily.json'dan kadın futbol ve U21 maçlarını çıkarır.
//
// Kullanıcı kuralı (10 Eyl 2026): "kadınlar futbol maçlarını yayınlama."
// ⚠️ YALNIZ FUTBOL. Kadın basketbol (FIBA Kadınlar Dünya Kupası) ve voleybol
// KALIR — kullanıcı özellikle "futbol" dedi, o gün feed'de kadın basketbolu
// vardı ve ona itiraz etmedi.
//
// Kullanıcı kuralı (30 Eyl 2026): "U21 maçlarını da koymamalısın."
// U21 milli takım maçları (U21 EURO elemeleri, U21 hazırlık) elenir.
//
// Fikstür her güncellendiğinde çalıştır:
//   node scripts/filtre.mjs assets/matches-daily.json
//
// Yazmadan önce ne sildiğini basar; hiçbir şey eşleşmezse dosyaya dokunmaz.
import fs from 'fs';

// Yarışma adı/kimliğinde bunlardan biri geçen FUTBOL maçı elenir.
const KADIN = [
  'women', 'woman', 'kadin', 'kadın', 'femin', 'damen', 'frauen',
  'feminine', 'femminile', 'dames', 'wsl', 'nwsl', 'frauen-bundesliga',
];

// Yarışma kimliği/adında ya da takım adında U21 geçen FUTBOL maçı elenir.
const U21 = /\bu-?21\b|under[- ]?21|sub-?21|21 ya[şs] alt/i;

const yol = process.argv[2] || 'assets/matches-daily.json';
const d = JSON.parse(fs.readFileSync(yol, 'utf8'));

const kadinMi = (m) => {
  if (m.sport !== 'football') return false;              // yalnız futbol
  const c = m.competition || {};
  const metin = [m.competitionId || '', ...Object.values(c)].join(' ').toLowerCase();
  return KADIN.some((k) => metin.includes(k));
};

const u21Mi = (m) => {
  if (m.sport !== 'football') return false;
  const metin = [m.competitionId || '', ...Object.values(m.competition || {}), m.home, m.away].join(' ');
  return U21.test(metin);
};
const elenirMi = (m) => kadinMi(m) || u21Mi(m);

const once = d.matches.length;
const atilan = d.matches.filter(elenirMi);
d.matches = d.matches.filter((m) => !elenirMi(m));

if (!atilan.length) {
  console.log('kadın futbolu / U21 yok — dosyaya dokunulmadı (' + once + ' maç)');
  process.exit(0);
}

for (const m of atilan) {
  console.log('  ÇIKARILDI  ' + (m.competition?.tr || m.competitionId) +
    '  |  ' + m.home + ' - ' + m.away);
}

// İstatistikleri yeniden hesapla — yoksa sayfadaki "bugün N maç" yalan söyler.
const bySport = {};
let withChannel = 0;
for (const m of d.matches) {
  bySport[m.sport] = (bySport[m.sport] || 0) + 1;
  if (Object.keys(m.broadcasts || {}).length) withChannel++;
}
d.stats = { ...d.stats, total: d.matches.length, withChannel, bySport };

fs.writeFileSync(yol, JSON.stringify(d, null, 1), 'utf8');
console.log('\n' + atilan.length + ' maç çıkarıldı (kadın futbolu / U21): ' +
  once + ' → ' + d.matches.length + ' maç');
