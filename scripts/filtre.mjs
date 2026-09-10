// KADIN FUTBOLU FİLTRESİ — matches-daily.json'dan kadın futbol maçlarını çıkarır.
//
// Kullanıcı kuralı (10 Eyl 2026): "kadınlar futbol maçlarını yayınlama."
// ⚠️ YALNIZ FUTBOL. Kadın basketbol (FIBA Kadınlar Dünya Kupası) ve voleybol
// KALIR — kullanıcı özellikle "futbol" dedi, o gün feed'de kadın basketbolu
// vardı ve ona itiraz etmedi.
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

const yol = process.argv[2] || 'assets/matches-daily.json';
const d = JSON.parse(fs.readFileSync(yol, 'utf8'));

const kadinMi = (m) => {
  if (m.sport !== 'football') return false;              // yalnız futbol
  const c = m.competition || {};
  const metin = [m.competitionId || '', ...Object.values(c)].join(' ').toLowerCase();
  return KADIN.some((k) => metin.includes(k));
};

const once = d.matches.length;
const atilan = d.matches.filter(kadinMi);
d.matches = d.matches.filter((m) => !kadinMi(m));

if (!atilan.length) {
  console.log('kadın futbolu yok — dosyaya dokunulmadı (' + once + ' maç)');
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
console.log('\n' + atilan.length + ' kadın futbol maçı çıkarıldı: ' +
  once + ' → ' + d.matches.length + ' maç');
