// src/takimlar.js'i uygulamanin constants/teams.ts dosyasindan yeniden uretir.
// Takim eklenince / takma ad yazilinca calistir:  node takimlar-uret.mjs  (Node 22.18+, .ts'i dogrudan okur)
// Anahtarlar SUNUCUNUN norm()'u ile (aksan atilir, cevrilmez) — dosyadaki ad da ayni norm'dan gecer.
import fs from 'fs';
import { execSync } from 'child_process';
import { norm } from './src/icerik.js';

const { TEAMS } = await import(new URL('../constants/teams.ts', import.meta.url));

const esleme = {};
for (const t of TEAMS) {
  (esleme[t.id] ||= []).includes(t.id) || esleme[t.id].push(t.id);   // ham kimlik de anahtar (mercedes_f1)
  for (const ad of [t.id, t.name, ...Object.values(t.nameLocal), ...(t.aliases ?? [])]) {
    const n = norm(ad);
    if (n.length < 3) continue;                 // Arapca adlar norm'da bos kalir
    (esleme[n] ||= []).includes(t.id) || esleme[n].push(t.id);
  }
}
// Ad baska bir takimin kimligiyse yalniz o kimlige gitsin (Kayseri'nin yerel adi "Kayserispor" ama ayri takim var)
const kimlikler = new Set(TEAMS.map((t) => t.id));
for (const [n, ids] of Object.entries(esleme)) if (kimlikler.has(n) && ids.length > 1 && n !== 'kayserispor') esleme[n] = [n];
const sirali = Object.fromEntries(Object.keys(esleme).sort().map((k) => [k, esleme[k]]));
const spor = Object.fromEntries(TEAMS.map((t) => [t.id, t.sport ?? 'football']).sort((a, b) => a[0].localeCompare(b[0])));

let surum = '?';
try { surum = execSync('git log -1 --format=%h -- constants/teams.ts', { cwd: new URL('..', import.meta.url) }).toString().trim(); } catch {}

const dosya = `// OTOMATIK URETILDI (takimlar-uret.mjs) — uygulamanin constants/teams.ts dosyasindan (${surum}, ${TEAMS.length} takim).
// Anahtar: fikstur dosyasindaki takim adinin norm() hali.
// Deger:   o adla eslesen UYGULAMA takim kimlikleri (Kayserispor gibi iki kimlik olabilir).
// Uygulama favori eslesmesini norm(ad) === takimId ile yapiyor; bazi kimlikler (betis,
// leverkusen, acmilan...) dosyadaki adla hic eslesmiyordu. Bu tablo o acigi sunucuda kapatir.
// Kaynak: takimin adi, yerel adlari ve aliases (fikstürde gorulen baska yazimlar: "RC Lens").
export const TAKIM_ESLEME = ${JSON.stringify(sirali).replace(/,"/g, ', "').replace(/":/g, '": ')};

// Takim kimligi -> spor dali. Uygulamanin constants/teams.ts dosyasindan uretildi.
// NEDEN: favori eslesmesi yalniz ADA bakiyordu; fikstur dosyasinda bir basketbol maci
// "Fenerbahçe" diye yazilsa (dogrusu "Fenerbahçe Beko") futbol icin Fenerbahçe secen
// kullaniciya basketbol bildirimi gidiyordu. 28 Eyl 2026 kullanici istegi: gitmesin.
export const TAKIM_SPORU = ${JSON.stringify(spor).replace(/,"/g, ', "').replace(/":/g, '": ')};

export const takimDali = (id) => TAKIM_SPORU[id] ?? 'football';
`;
fs.writeFileSync(new URL('./src/takimlar.js', import.meta.url), dosya);
console.log(`src/takimlar.js yazildi: ${Object.keys(sirali).length} anahtar, ${TEAMS.length} takim`);
