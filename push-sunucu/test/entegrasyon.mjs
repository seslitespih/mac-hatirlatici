// Uctan uca test: gercek Workers calisma ortami (wrangler dev) + yerel D1 + sahte Expo.
// Calistir: node test/entegrasyon.mjs
//
// Senaryo
//   A (TR, tr)  besiktas + fenerbahce takip eder
//   B (GB, en)  besiktas + betis takip eder, token'i OLU (Expo DeviceNotRegistered doner)
//   Maclar:
//     1) Besiktas–Marseille  global,  10 dk sonra  -> A ve B'ye gitmeli
//     2) Real Betis–Getafe   global,  60 dk sonra  -> henuz ZAMANI DEGIL
//     3) Fenerbahce–Rizespor yalniz GB kanali, 5 dk sonra -> A Turkiye'de goremez, GITMEMELI
//     4) Galatasaray–Konyaspor global, 12 dk sonra -> ilk basta takipcisi yok
//   Beklenen: 2 mesaj; B silinir; ikinci cron'da tekrar gonderim YOK; bos liste = abonelik silinir.
//   Ek: iki /tetikle AYNI ANDA -> C'ye tek bildirim; gecici Expo hatasi -> sahiplenme geri alinir,
//       sonraki calismada gider; Saat alarmi cron OLMADAN tek basina gonderir.

import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const MOCK_PORT = 18977, DEV_PORT = 18976;
const simdi = Date.now();
const iso = (dk) => new Date(simdi + dk * 60_000).toISOString();

const FIKSTUR = {
  date: 'test',
  matches: [
    { id: 'm1', sport: 'football', tier: 'global', competitionId: 'europa',
      competition: { tr: 'UEFA Avrupa Ligi', en: 'UEFA Europa League' },
      home: 'Besiktas', away: 'Marseille', homeNames: { tr: 'Beşiktaş', en: 'Beşiktaş' }, awayNames: { tr: 'Marsilya', en: 'Marseille' },
      kickoffUtc: iso(10), broadcasts: { TR: ['TRT 1'], GB: ['TNT Sports 2'] } },
    { id: 'm2', sport: 'football', tier: 'global', competitionId: 'laliga',
      competition: { en: 'LaLiga' }, home: 'Real Betis', away: 'Getafe', homeNames: {}, awayNames: {},
      kickoffUtc: iso(60), broadcasts: { GB: ['Premier Sports 1'] } },
    { id: 'm3', sport: 'football', tier: 'regional', competitionId: 'superlig',
      competition: { en: 'Super Lig' }, home: 'Fenerbahce', away: 'Rizespor', homeNames: {}, awayNames: {},
      kickoffUtc: iso(5), broadcasts: { GB: ['Some Channel'] } },
    { id: 'm4', sport: 'football', tier: 'global', competitionId: 'superlig',
      competition: { en: 'Super Lig' }, home: 'Galatasaray', away: 'Konyaspor', homeNames: {}, awayNames: {},
      kickoffUtc: iso(12), broadcasts: { TR: ['beIN Sports 1'] } },
  ],
};

const gelenler = [];
const geciciDeneme = new Map();   // GECICI tokenlara ilk denemede hata don
const mock = http.createServer((req, res) => {
  if (req.url === '/fikstur.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(FIKSTUR));
  }
  if (req.url === '/push' && req.method === 'POST') {
    let g = '';
    req.on('data', (c) => (g += c));
    req.on('end', () => {
      const mesajlar = JSON.parse(g);
      gelenler.push(...mesajlar);
      const data = mesajlar.map((m) => {
        if (m.to.includes('OLU')) return { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } };
        if (m.to.includes('GECICI')) {
          const n = (geciciDeneme.get(m.to) ?? 0) + 1; geciciDeneme.set(m.to, n);
          if (n === 1) return { status: 'error', message: 'rate', details: { error: 'MessageRateExceeded' } };
        }
        return { status: 'ok', id: 'bilet-' + Math.random() };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data }));
    });
    return;
  }
  res.writeHead(404); res.end();
});
await new Promise((ok) => mock.listen(MOCK_PORT, '127.0.0.1', ok));

rmSync('.wrangler', { recursive: true, force: true });
execSync('npx wrangler d1 execute mac-hatirlatici-push --local --file=schema.sql', { stdio: 'pipe' });

const dev = spawn('npx', [
  'wrangler', 'dev', '--local', '--test-scheduled', '--port', String(DEV_PORT),
  '--var', `FIKSTUR_URL:http://127.0.0.1:${MOCK_PORT}/fikstur.json`,
  '--var', `EXPO_PUSH_URL:http://127.0.0.1:${MOCK_PORT}/push`,
  '--var', 'TETIK_ANAHTARI:test-anahtari-123',
  '--var', 'ALARM_OTOMATIK:0',
  '--var', 'ALARM_ARALIK_MS:2000',
], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
let devLog = '';
dev.stdout.on('data', (d) => (devLog += d));
dev.stderr.on('data', (d) => (devLog += d));

const TABAN = `http://127.0.0.1:${DEV_PORT}`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${TABAN}/saglik`)).status) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

let basarisiz = 0;
const kontrol = (ad, kosul, ek = '') => {
  console.log(`${kosul ? 'GECTI ' : 'KALDI '} ${ad}${ek ? '  → ' + ek : ''}`);
  if (!kosul) basarisiz++;
};
const kayit = (govde) => fetch(`${TABAN}/kayit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
const saglik = async () => (await fetch(`${TABAN}/saglik`)).json();
const cron = () => fetch(`${TABAN}/__scheduled?cron=*+*+*+*+*`);

const A = 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAA]';
const B = 'ExponentPushToken[OLUOLUOLUOLUOLUOLU01]';

try {
  kontrol('gecerli kayit A', (await kayit({ token: A, takimlar: ['besiktas', 'fenerbahce'], dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' })).status === 200);
  kontrol('gecerli kayit B', (await kayit({ token: B, takimlar: ['besiktas', 'betis'], dil: 'en', ulke: 'GB', tz: 'Europe/London', platform: 'ios' })).status === 200);
  kontrol('gecersiz token reddedilir', (await kayit({ token: 'rastgele', takimlar: ['x1'], ulke: 'TR' })).status === 400);
  kontrol('ayni token tekrar kayit (guncelleme)', (await kayit({ token: A, takimlar: ['besiktas', 'fenerbahce'], dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' })).status === 200);
  kontrol('iki abone', (await saglik()).abone === 2, JSON.stringify(await saglik()));

  await cron();
  await new Promise((r) => setTimeout(r, 1500));

  const s1 = await saglik();
  kontrol('plan dolduruldu (4 mac)', s1.plan === 4, `plan=${s1.plan}`);
  kontrol('toplam 2 mesaj gonderildi', gelenler.length === 2, `gelen=${gelenler.length}`);

  const mA = gelenler.find((m) => m.to === A);
  kontrol('A Besiktas mesajini aldi', !!mA);
  kontrol('A basligi Turkce', mA?.title === '⚽ Beşiktaş vs Marsilya – 15 dk kaldı!', mA?.title);
  kontrol('A govdesi TRT 1 ve Istanbul saati', /^🕐 \d\d:\d\d \| UEFA Avrupa Ligi\n📺 TRT 1\n/.test(mA?.body ?? ''), JSON.stringify(mA?.body));
  kontrol('A mac verisi m1', mA?.data?.macId === 'm1');
  kontrol('ttl mac saatini gecmiyor', mA && mA.ttl <= 10 * 60 && mA.ttl > 8 * 60, `ttl=${mA?.ttl}`);
  const mB = gelenler.find((m) => m.to === B);
  kontrol('B Ingilizce ve TNT', mB?.title === '⚽ Beşiktaş vs Marseille – 15 min to kickoff!' && mB?.body.includes('📺 on TNT Sports 2'), mB?.body);
  kontrol('Fenerbahce maci (TR kanali yok) A ya GITMEDI', !gelenler.some((m) => m.data?.macId === 'm3'));
  kontrol('Betis maci (60 dk sonra) henuz GITMEDI', !gelenler.some((m) => m.data?.macId === 'm2'));

  kontrol('olu token B silindi', s1.abone === 1, `abone=${s1.abone}`);
  kontrol('gonderilen kaydi 1', s1.gonderilen24s === 1, `gonderilen=${s1.gonderilen24s}`);

  await cron();
  await new Promise((r) => setTimeout(r, 1500));
  kontrol('ikinci cron: TEKRAR GONDERIM YOK', gelenler.length === 2, `gelen=${gelenler.length}`);

  kontrol('/tetikle anahtarsiz -> 401', (await fetch(`${TABAN}/tetikle`, { method: 'POST' })).status === 401);
  kontrol('/tetikle yanlis anahtar -> 401', (await fetch(`${TABAN}/tetikle`, { method: 'POST', headers: { Authorization: 'Bearer yanlis' } })).status === 401);
  const tr = await fetch(`${TABAN}/tetikle?plan=1`, { method: 'POST', headers: { Authorization: 'Bearer test-anahtari-123' } });
  const tj = await tr.json();
  kontrol('/tetikle dogru anahtar -> 200, plan 4 mac, tekrar gonderim yok', tr.status === 200 && tj.planMac === 4 && tj.gonderilen === 0, JSON.stringify(tj));
  kontrol('/tetikle sonrasi da cift gonderim yok', gelenler.length === 2, `gelen=${gelenler.length}`);

  // --- Es zamanli iki tetik: sahiplenme cift gonderimi engellemeli ---
  const C = 'ExponentPushToken[CCCCCCCCCCCCCCCCCCCC]';
  await kayit({ token: C, takimlar: ['galatasaray'], dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' });
  const tetik = () => fetch(`${TABAN}/tetikle`, { method: 'POST', headers: { Authorization: 'Bearer test-anahtari-123' } }).then((r) => r.json());
  await Promise.all([tetik(), tetik(), tetik()]);
  const cMesaj = gelenler.filter((m) => m.to === C);
  kontrol('AYNI ANDA 3 tetik -> C ye TEK bildirim', cMesaj.length === 1, `C mesaj=${cMesaj.length}`);

  // --- Gecici Expo hatasi: sahiplenme geri alinmali, sonraki calismada gitmeli ---
  const G = 'ExponentPushToken[GECICIGECICIGECICI01]';
  await kayit({ token: G, takimlar: ['galatasaray'], dil: 'en', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' });
  const g1 = await tetik();
  kontrol('gecici hata: ilk deneme basarisiz sayildi', g1.gonderilen === 0, JSON.stringify(g1));
  const g2 = await tetik();
  kontrol('gecici hata: ikinci calismada gonderildi', g2.gonderilen === 1, JSON.stringify(g2));
  const g3 = await tetik();
  kontrol('gecici hata: ucuncude tekrar YOK', g3.gonderilen === 0 && gelenler.filter((m) => m.to === G).length === 2, `G deneme=${gelenler.filter((m) => m.to === G).length}`);

  // --- Saat alarmi: cron ve /tetikle OLMADAN tek basina gondermeli ---
  const E = 'ExponentPushToken[EEEEEEEEEEEEEEEEEEEE]';
  await kayit({ token: E, takimlar: ['fenerbahce'], dil: 'en', ulke: 'GB', tz: 'Europe/London', platform: 'ios' });
  const sr = await fetch(`${TABAN}/saat`, { method: 'POST', headers: { Authorization: 'Bearer test-anahtari-123' } });
  kontrol('/saat anahtarla -> alarm kuruldu', sr.status === 200 && (await sr.json()).alarm > 0);
  kontrol('/saat anahtarsiz -> 401', (await fetch(`${TABAN}/saat`, { method: 'POST' })).status === 401);
  let eMesaj = [];
  for (let i = 0; i < 15 && eMesaj.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    eMesaj = gelenler.filter((m) => m.to === E);
  }
  kontrol('ALARM tek basina E ye Fenerbahce bildirimini gonderdi', eMesaj.length === 1 && eMesaj[0].data.macId === 'm3', `E mesaj=${eMesaj.length}`);
  await new Promise((r) => setTimeout(r, 5000));   // alarm 2 sn'de bir calismaya devam ediyor
  kontrol('alarm calismaya devam etse de E ye TEKRAR YOK', gelenler.filter((m) => m.to === E).length === 1);
  kontrol('saglik: sonraki alarm gorunuyor', !!(await saglik()).sonrakiAlarm);

  for (const t of [A, C, G, E]) await kayit({ token: t, takimlar: [], dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' });
  kontrol('takip birakma: tum abonelikler silindi', (await saglik()).abone === 0);
} catch (e) {
  console.log('TEST HATASI', e);
  basarisiz++;
} finally {
  dev.kill();
  try { execSync(`taskkill /F /T /PID ${dev.pid}`, { stdio: 'ignore' }); } catch {}
  // Windows'ta yukaridaki yetmiyor: workerd'u dogururan wrangler agaci yasiyor, portu tutuyor ve
  // sonraki test SESSIZCE bos cikti veriyor. Portu dinleyen surecin ebeveyn zincirinden
  // 'wrangler dev' kokunu bulup agaci kapat.
  if (process.platform === 'win32') {
    const ps = `$c = Get-NetTCPConnection -LocalPort ${DEV_PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
      `if ($c) { $z=@(); $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"; ` +
      `while ($p -and $z.Count -lt 7) { $z += $p; $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue }; ` +
      `$k = $z | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'wrangler' -and $_.CommandLine -match ' dev ' } | Select-Object -Last 1; ` +
      `if ($k) { taskkill /F /T /PID $k.ProcessId | Out-Null } else { Stop-Process -Id $c.OwningProcess -Force } }`;
    try { execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: 'ignore' }); } catch {}
  }
  mock.close();
}

if (basarisiz) {
  console.log(`\n${basarisiz} KONTROL KALDI\n--- wrangler log (son) ---\n` + devLog.slice(-3000));
  process.exit(1);
}
console.log('\nTUM KONTROLLER GECTI');
process.exit(0);
