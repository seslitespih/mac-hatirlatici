// Dal butunlugu kontrolu — push'tan ONCE calistir:  node scripts/kapsam-kontrol.mjs
//
// NEDEN: 18 Eyl 2026 gece calismasi TR kaynagindaki DORT bolumden yalniz `futbol`u isledi.
// Basketbol (EuroLeague Super Kupa: Fenerbahce Beko, Real Madrid — kullanicinin favorileri) ve
// motorspor (MotoGP Avusturya) komple dustu. Dosya 18 mac yerine 24 mac olmaliydi.
// Yazili kural tek basina yetmedi (11-12 Eyl'de seanslar girmisti, 18 Eyl'de "yaris yok" denip atlandi),
// bu yuzden makine kontrolu: kaynakta o dalda mac VARSA dosyada da olmali.
//
// Cikis kodu 1 -> eksik var, PUSH ETME.

import { readFileSync } from 'node:fs';

const DOSYA = process.argv[2] ?? 'assets/matches-daily.json';   // test icin yol verilebilir
const TR_API = 'https://hangikanalda.app/api/proxy/matches';
const ESLEME = { futbol: 'football', basketbol: 'basketball', voleybol: 'volleyball', motor: 'motorsport' };

// Talimat §3'e gore ZATEN girmeyen ligler. Kaynaktaki maclarin HEPSI bunlardansa
// o dalin dosyada olmamasi dogrudur; kontrol bunu eksik saymaz.
// (21 Eyl 2026: basketbol bolumunde yalniz WNBA + Avustralya NBL vardi.)
const KAPSAM_DISI = [
  /wnba/i, /avustralya nbl/i, /\bnbl\b/i,          // kadin kulup ligi / nis lig
  /fiba europe cup/i,                               // 3. seviye Avrupa kulup kupasi — §3 basketbol kapsaminda degil (uygulamada takim yok)
  /basketbol 1\. ligi/i, // TR ikinci seviye + altyapi
  /on eleme youtube/i,
  /usl/i, /primera nacional/i, /primera c/i,        // alt ligler
  /kadin|women|femin|frauen|feminin|femenin/i,      // kadin futbolu (filtre.mjs de eler)
  /sub-?\d|u-?1[5-9]|u-?2[01]/i,                    // altyapi
];
const kapsamDisiMi = (ligAdi) => KAPSAM_DISI.some((r) => r.test(ligAdi));

const d = JSON.parse(readFileSync(DOSYA, 'utf8'));
const dosyaSayim = {};
for (const m of d.matches) dosyaSayim[m.sport] = (dosyaSayim[m.sport] ?? 0) + 1;

let tr;
try {
  const r = await fetch(TR_API, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  tr = await r.json();
} catch (e) {
  console.log(`TR kaynagi okunamadi (${e.message}) — dal kontrolu YAPILAMADI, elle bak.`);
  process.exit(0);   // kaynak erisilemiyorsa push'u engelleme
}

console.log(`dosya: ${d.date} · ${d.matches.length} mac`);
let eksik = 0;
for (const [bolum, spor] of Object.entries(ESLEME)) {
  const ligler = tr[bolum]?.leagues ?? [];
  const kaynak = ligler.reduce((n, lg) => n + (lg.matches?.length ?? 0), 0);
  const kapsamli = ligler
    .filter((lg) => !kapsamDisiMi(lg.name ?? ''))
    .reduce((n, lg) => n + (lg.matches?.length ?? 0), 0);
  const bizde = dosyaSayim[spor] ?? 0;
  const durum = kapsamli > 0 && bizde === 0 ? 'EKSIK' : 'tamam';
  const not = kaynak > 0 && kapsamli === 0 ? '  (kaynaktakilerin hepsi kapsam disi)' : '';
  console.log(`  ${spor.padEnd(11)} kaynakta ${String(kaynak).padStart(3)} · dosyada ${String(bizde).padStart(3)}  ${durum}${not}`);
  if (durum === 'EKSIK') {
    eksik++;
    for (const lg of tr[bolum].leagues) {
      for (const m of lg.matches ?? []) console.log(`      ${m.time}  ${lg.name}  ${m.home} - ${m.away}`);
    }
  }
}

// Futbolda bir ligin maclarini yarim almak (18 Eyl: 2. Bundesliga) — TR liglerini karsilastir
const ligSayim = {};
for (const lg of tr.futbol?.leagues ?? []) ligSayim[lg.name] = (lg.matches ?? []).length;
console.log('  TR kaynagindaki futbol ligleri (dosyayla elle karsilastir):');
for (const [ad, n] of Object.entries(ligSayim)) console.log(`      ${String(n).padStart(2)}x ${ad}`);

if (eksik) {
  console.log(`\n${eksik} dal EKSIK — talimat §3 "ALTIN KURAL" ve §6 kontrol 7. PUSH ETME, tamamla.`);
  process.exit(1);
}
console.log('\ndal butunlugu tamam.');
