// Calistir: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  norm, takimKimlikleri, sec, yerelSaat, gorunurMu, planKaydi,
  zamaniGeldiMi, bildirimIcerigi, kayitDogrula,
} from '../src/icerik.js';

test('norm: uygulamanin 1.4.3 davranisiyla ayni (aksanli harfi SILER)', () => {
  assert.equal(norm('Fenerbahce'), 'fenerbahce');
  assert.equal(norm('Fenerbahçe'), 'fenerbahe');
  assert.equal(norm('Paris Saint-Germain FC Very Long'), 'parissaintgermainfcver');   // 22 karakter
});

test('takim eslesmesi: uygulamada adla eslesmeyen kimlikler sunucuda yakalanir', () => {
  assert.ok(takimKimlikleri('Real Betis').includes('betis'));
  assert.ok(takimKimlikleri('Bayer Leverkusen').includes('leverkusen'));
  assert.ok(takimKimlikleri('Milan').includes('acmilan'));
  assert.ok(takimKimlikleri('Manchester City').includes('mancity'));
  assert.ok(takimKimlikleri('Manchester United').includes('manutd'));
  assert.ok(takimKimlikleri('Atletico Madrid').includes('atletico'));
  assert.ok(takimKimlikleri('Borussia Dortmund').includes('dortmund'));
  assert.ok(takimKimlikleri('Bodrumspor').includes('bodrumfk'));
  const k = takimKimlikleri('Kayserispor');
  assert.ok(k.includes('kayseri') && k.includes('kayserispor'), 'iki kimlik de');
  // birebir eslesenler bozulmamali
  assert.deepEqual(takimKimlikleri('Fenerbahce'), ['fenerbahce']);
  assert.deepEqual(takimKimlikleri('Besiktas'), ['besiktas']);
  // tabloda olmayan: uygulamanin kendi kurali (norm === id)
  assert.deepEqual(takimKimlikleri('Stenhousemuir'), ['stenhousemuir']);
  assert.deepEqual(takimKimlikleri(''), []);
});

test('sec: uygulamadaki pick ile ayni', () => {
  assert.equal(sec({ tr: 'Türkiye', en: 'Turkey' }, 'tr', 'X'), 'Türkiye');
  assert.equal(sec({ tr: 'Türkiye', en: 'Turkey' }, 'de-DE', 'X'), 'Turkey');
  assert.equal(sec({}, 'tr', 'Fenerbahce'), 'Fenerbahce');
  assert.equal(sec(undefined, 'tr', 'Fenerbahce'), 'Fenerbahce');
});

test('yerelSaat: kullanicinin saat diliminde, 24 saat', () => {
  const ms = Date.parse('2026-09-17T19:00:00Z');
  assert.equal(yerelSaat(ms, 'Europe/Istanbul'), '22:00');
  assert.equal(yerelSaat(ms, 'America/Sao_Paulo'), '16:00');
  assert.equal(yerelSaat(ms, 'Gecersiz/Dilim'), '19:00');
});

test('gorunurMu: kanal yoksa yalniz global maclar', () => {
  assert.equal(gorunurMu({ tier: 'regional', broadcasts: { TR: ['beIN Sports 1'] } }, 'TR'), true);
  assert.equal(gorunurMu({ tier: 'regional', broadcasts: { TR: ['beIN Sports 1'] } }, 'DE'), false);
  assert.equal(gorunurMu({ tier: 'global',   broadcasts: {} }, 'DE'), true);
});

test('zamaniGeldiMi: maca 15 dk ve daha az kala, baslamadan once', () => {
  const k = Date.parse('2026-09-17T19:00:00Z');
  assert.equal(zamaniGeldiMi(k, k - 16 * 60_000), false);
  assert.equal(zamaniGeldiMi(k, k - 15 * 60_000), true);
  assert.equal(zamaniGeldiMi(k, k - 60_000), true);
  assert.equal(zamaniGeldiMi(k, k), false);
});

// Beklenen metin, uygulamanin buildNotificationContent kodundan elle kuruldu:
//   title: `${emoji} ${home} vs ${away} – ${minsLeft}!`
//   body:  [`🕐 ${saat} | ${lig}`, `📺 ${on ? on+' ' : ''}${kanal}`, note].join('\n')
const MAC = {
  sport: 'football', tier: 'global', competitionId: 'europa',
  competition: { tr: 'UEFA Avrupa Ligi', en: 'UEFA Europa League' },
  home: 'Besiktas', away: 'Marseille',
  homeNames: { tr: 'Beşiktaş', en: 'Beşiktaş' }, awayNames: { tr: 'Marsilya', en: 'Marseille' },
  broadcasts: { TR: ['TRT 1', 'CBC Sport'], GB: ['TNT Sports 2'] },
};
const KICKOFF = Date.parse('2026-09-17T19:00:00Z');

test('bildirim metni: Turkce, kanal satirinda edat yok', () => {
  const { title, body } = bildirimIcerigi(MAC, KICKOFF, { dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul' });
  assert.equal(title, '⚽ Beşiktaş vs Marsilya – 15 dk kaldı!');
  assert.equal(body, '🕐 22:00 | UEFA Avrupa Ligi\n📺 TRT 1\n(Sadece maç saati hatırlatıcısı. Gol bildirimi verilmez.)');
});

test('bildirim metni: Ingilizce, "on" edati, Londra saati', () => {
  const { title, body } = bildirimIcerigi(MAC, KICKOFF, { dil: 'en', ulke: 'GB', tz: 'Europe/London' });
  assert.equal(title, '⚽ Beşiktaş vs Marseille – 15 min to kickoff!');
  assert.equal(body, '🕐 20:00 | UEFA Europa League\n📺 on TNT Sports 2\n(Match time reminder only. No goal alerts.)');
});

test('bildirim metni: kanal yoksa kanal satiri hic yok; bilinmeyen dil Ingilizceye duser', () => {
  const { body } = bildirimIcerigi(MAC, KICKOFF, { dil: 'ja', ulke: 'JP', tz: 'Asia/Tokyo' });
  assert.equal(body, '🕐 04:00 | UEFA Europa League\n(Match time reminder only. No goal alerts.)');
});

test('bildirim metni: motorsporda "vs" yok', () => {
  const f1 = { ...MAC, sport: 'motorsport', home: 'Formula 1 Madrid GP', away: 'Siralama', homeNames: {}, awayNames: {} };
  const { title } = bildirimIcerigi(f1, KICKOFF, { dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul' });
  assert.equal(title, '🏎️ Formula 1 Madrid GP – 15 dk kaldı!');
});

test('planKaydi: takim kimlikleri ve zaman', () => {
  const k = planKaydi({ id: 'x', kickoffUtc: '2026-09-17T19:00:00Z', home: 'Real Betis', away: 'Getafe', ...MAC });
  assert.equal(k.kickoff, KICKOFF);
  assert.equal(planKaydi({ id: 'y', kickoffUtc: 'bozuk', home: 'A', away: 'B' }), null);
});

test('kayitDogrula', () => {
  const iyi = { token: 'ExponentPushToken[abcdefghijklmnop]', takimlar: ['fenerbahce', 'fenerbahce', 'X!'], dil: 'tr', ulke: 'TR', tz: 'Europe/Istanbul', platform: 'ios' };
  const { deger } = kayitDogrula(iyi);
  assert.deepEqual(deger.takimlar, ['fenerbahce'], 'tekrar ve gecersiz kimlik ayiklanir');
  assert.equal(kayitDogrula({ ...iyi, token: 'rastgele' }).hata, 'token gecersiz');
  assert.equal(kayitDogrula({ ...iyi, ulke: '' }).hata, 'ulke gecersiz');
  assert.deepEqual(kayitDogrula({ ...iyi, takimlar: [] }).deger.takimlar, [], 'bos liste = takip birakma, gecerli');
  assert.equal(kayitDogrula({ ...iyi, tz: 'Olmayan/Yer' }).deger.tz, 'UTC');
  assert.equal(kayitDogrula({ ...iyi, dil: 'turkce' }).deger.dil, 'en');
});
