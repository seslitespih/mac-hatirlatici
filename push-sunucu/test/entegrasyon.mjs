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
//   Beklenen: 2 mesaj; B silinir; ikinci cron'da tekrar gonderim YOK; bos liste = abonelik silinir.

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
  ],
};

const gelenler = [];
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
      const data = mesajlar.map((m) => m.to.includes('OLU')
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'bilet-' + Math.random() });
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
  kontrol('plan dolduruldu (3 mac)', s1.plan === 3, `plan=${s1.plan}`);
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

  kontrol('takip birakma (bos liste) kabul', (await kayit({ token: A, takimlar: [], dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' })).status === 200);
  kontrol('abonelik silindi', (await saglik()).abone === 0);
} catch (e) {
  console.log('TEST HATASI', e);
  basarisiz++;
} finally {
  dev.kill();
  try { execSync(`taskkill /F /T /PID ${dev.pid}`, { stdio: 'ignore' }); } catch {}
  mock.close();
}

if (basarisiz) {
  console.log(`\n${basarisiz} KONTROL KALDI\n--- wrangler log (son) ---\n` + devLog.slice(-3000));
  process.exit(1);
}
console.log('\nTUM KONTROLLER GECTI');
process.exit(0);
