// Mac Hatirlatici — push bildirim sunucusu (Cloudflare Worker + D1 + Durable Object alarmi)
//
// NEDEN: uygulama yerel bildirimleri yalniz ACILDIGINDA kuruyordu; kullanici o gun
// uygulamayi acmazsa bildirim gelmiyordu. Bu sunucu kullanicinin takimlarini bilir ve
// maca 15 dk kala Expo Push ile bildirimi kendisi gonderir.
//
// AKIS
//   POST /kayit          uygulama: push token + takimlar + dil + ulke + saat dilimi
//   Saat (DO alarmi)     her dakika calis(): 10 dk'da bir plani yenile, zamani gelenleri gonder
//   cron (her dakika)    ayni calis() — yedek; biri calismasa digeri yeter
//   GET  /saglik         sayilar + alarm durumu (token/takim bilgisi DONMEZ)
//   POST /tetikle        calis()'i hemen calistirir (Bearer TETIK_ANAHTARI). ?plan=1 plani zorla yeniler.
//   POST /saat           alarmi baslatir (Bearer TETIK_ANAHTARI)
//
// NEDEN IKI TETIK: 17 Eyl 2026'da yeni acilan hesapta cron tetikleyicisi deploy'dan 30+ dk
// sonra bile HIC calismadi (Cloudflare analitiginde 0 zamanlanmis calisma). Durable Object
// alarmi ayri bir mekanizma; kendi bir sonraki alarmini kurarak dakikada bir calisir.
//
// CIFT BILDIRIM YOK: gondermeden ONCE `gonderilen` tablosuna yazilir (sahiplenme). Iki tetik
// ayni dakikaya denk gelse bile bir (mac, cihaz) satirini yalniz biri yazabilir, yalniz o gonderir.
//
// UCRETSIZ PLAN SINIRI: calisma basina ~50 D1 sorgusu. Tum toplu isler json_each ile TEK sorguda
// yapilir; mac ve abone sayisi ne olursa olsun calisma basina sorgu sayisi sabit kalir.

import {
  planKaydi, zamaniGeldiMi, gorunurMu, bildirimIcerigi, ozetIcerigi, kayitDogrula,
  yerelSaat, HATIRLAT_DK, OZET_SAAT,
} from './icerik.js';

// Sabah ozeti (09:00) o gunun tamamini bilmek zorunda; bu yuzden ufuk 6 saat degil
// 26 saat. gonder() zaten yalniz 15 dk icindeki maclara bakiyor, etkilenmiyor.
const PLAN_UFKU_MS = 26 * 60 * 60 * 1000;
const OZET_PENCERE_DK = 15;                // 09:00-09:14 arasinda gonderilir
const GUN_MS          = 86_400_000;
const EXPO_PARTI   = 100;                   // Expo tek istekte en fazla 100 mesaj alir
const JSON_SINIR   = 8 * 1024;

const json = (veri, durum = 200) =>
  new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': 'application/json' } });

const saat = (env) => env.SAAT.get(env.SAAT.idFromName('tek'));
const alarmOtomatik = (env) => env.ALARM_OTOMATIK !== '0';

export default {
  async fetch(istek, env, ctx) {
    const url = new URL(istek.url);

    if (istek.method === 'POST' && url.pathname === '/kayit') {
      const ham = await istek.text();
      if (ham.length > JSON_SINIR) return json({ hata: 'cok buyuk' }, 413);
      let govde;
      try { govde = JSON.parse(ham); } catch { return json({ hata: 'json degil' }, 400); }
      const { deger, hata } = kayitDogrula(govde);
      if (hata) return json({ hata }, 400);
      await kaydet(env, deger);
      if (alarmOtomatik(env)) ctx.waitUntil(saat(env).fetch('https://saat/baslat').catch(() => {}));
      return json({ ok: true });
    }

    if (istek.method === 'POST' && (url.pathname === '/tetikle' || url.pathname === '/saat')) {
      if (!env.TETIK_ANAHTARI || !(await anahtarDogruMu(istek.headers.get('Authorization') ?? '', `Bearer ${env.TETIK_ANAHTARI}`))) {
        return json({ hata: 'yetkisiz' }, 401);
      }
      if (url.pathname === '/saat') {
        return json({ ok: true, ...(await (await saat(env).fetch('https://saat/baslat')).json()) });
      }
      return json({ ok: true, ...(await calis(env, Date.now(), url.searchParams.get('plan') === '1')) });
    }

    if (istek.method === 'GET' && url.pathname === '/saglik') {
      const [a, p, g] = await env.DB.batch([
        env.DB.prepare('SELECT COUNT(*) AS n FROM aboneler'),
        env.DB.prepare('SELECT COUNT(*) AS n, MIN(kickoff) AS ilk, MAX(kickoff) AS son FROM plan'),
        env.DB.prepare('SELECT COUNT(*) AS n FROM gonderilen WHERE ts > ?').bind(Date.now() - 86_400_000),
      ]);
      let alarm = null;
      try {
        const yol = alarmOtomatik(env) ? 'https://saat/baslat' : 'https://saat/durum';   // saglik kontrolu alarmi da ayakta tutar
        alarm = (await (await saat(env).fetch(yol)).json()).alarm;
      } catch { /* bilgi amacli */ }
      return json({
        ok: true,
        abone: a.results[0].n,
        plan: p.results[0].n,
        planIlk: p.results[0].ilk ? new Date(p.results[0].ilk).toISOString() : null,
        planSon: p.results[0].son ? new Date(p.results[0].son).toISOString() : null,
        gonderilen24s: g.results[0].n,
        sonrakiAlarm: alarm ? new Date(alarm).toISOString() : null,
      });
    }

    return json({ hata: 'bulunamadi' }, 404);
  },

  async scheduled(olay, env, ctx) {
    await calis(env, olay.scheduledTime, false);
    if (alarmOtomatik(env)) ctx.waitUntil(saat(env).fetch('https://saat/baslat').catch(() => {}));
  },
};

// ─── Saat: kendini her dakika yeniden kuran alarm ─────────────────────────────

export class Saat {
  constructor(durum, env) {
    this.durum = durum;
    this.env = env;
  }

  sonraki(simdi) {
    const aralik = Number(this.env.ALARM_ARALIK_MS) || 60_000;
    // Uretimde dakika basinin 2 sn sonrasina hizala; testte kisa aralik
    return aralik === 60_000 ? Math.floor(simdi / 60_000) * 60_000 + 62_000 : simdi + aralik;
  }

  async fetch(istek) {
    const yol = new URL(istek.url).pathname;
    let alarm = await this.durum.storage.getAlarm();
    if (yol === '/baslat' && alarm == null) {
      alarm = this.sonraki(Date.now());
      await this.durum.storage.setAlarm(alarm);
      console.log('saat baslatildi', new Date(alarm).toISOString());
    }
    return json({ alarm });
  }

  async alarm() {
    // Bir sonraki alarmi ONCE kur: calis() hata verse bile zincir kopmasin.
    const simdi = Date.now();
    await this.durum.storage.setAlarm(this.sonraki(simdi));
    try {
      await calis(this.env, simdi, false);
    } catch (e) {
      console.log('saat calis hatasi', String(e?.stack ?? e));
    }
  }
}

// ─── Ortak is ────────────────────────────────────────────────────────────────

async function calis(env, simdi, planZorla) {
  const dakika = new Date(simdi).getUTCMinutes();
  let planMac = null;
  if (planZorla || dakika % 10 === 0 || (await planBosMu(env))) {
    planMac = await planYenile(env, simdi);
  }
  const gonderilen = await gonder(env, simdi);
  const ozet = await ozetGonder(env, simdi);
  return { planMac, gonderilen, ozet };
}

/** Zamanlama saldirisina karsi sabit sureli karsilastirma. */
async function anahtarDogruMu(gelen, beklenen) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(gelen)),
    crypto.subtle.digest('SHA-256', enc.encode(beklenen)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// ─── Kayit (sabit 2-3 sorgu) ─────────────────────────────────────────────────

async function kaydet(env, k) {
  const silTakim = env.DB.prepare('DELETE FROM abone_takim WHERE token = ?').bind(k.token);

  // Takip birakildi -> tamamen sil; sunucu bu cihaza bir daha gondermez.
  if (k.takimlar.length === 0) {
    await env.DB.batch([silTakim, env.DB.prepare('DELETE FROM aboneler WHERE token = ?').bind(k.token)]);
    return;
  }

  await env.DB.batch([   // D1 batch tek islem (transaction) olarak calisir
    env.DB.prepare(
      `INSERT INTO aboneler (token, dil, ulke, tz, platform, dallar, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET dil = excluded.dil, ulke = excluded.ulke, tz = excluded.tz,
         platform = excluded.platform, dallar = excluded.dallar, guncelleme = excluded.guncelleme`,
    ).bind(k.token, k.dil, k.ulke, k.tz, k.platform, JSON.stringify(k.dallar), Date.now()),
    silTakim,
    env.DB.prepare('INSERT INTO abone_takim (token, takim) SELECT ?, value FROM json_each(?)')
      .bind(k.token, JSON.stringify(k.takimlar)),
  ]);
}

// ─── Plan (sabit 1 + 4 sorgu) ────────────────────────────────────────────────

async function planBosMu(env) {
  const r = await env.DB.prepare('SELECT 1 FROM plan LIMIT 1').first();
  return !r;
}

async function planYenile(env, simdi) {
  let dosya;
  try {
    const yanit = await fetch(env.FIKSTUR_URL, { cf: { cacheTtl: 60 } });
    if (!yanit.ok) { console.log('fikstur alinamadi', yanit.status); return null; }
    dosya = await yanit.json();
  } catch (e) {
    console.log('fikstur okunamadi', String(e));
    return null;   // hata durumunda mevcut plana DOKUNMA
  }

  const kayitlar = (dosya.matches ?? [])
    .map(planKaydi)
    .filter((k) => k && k.kickoff > simdi && k.kickoff <= simdi + PLAN_UFKU_MS);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO plan (mac_id, kickoff, takimlar, veri)
         SELECT json_extract(value, '$.mac_id'), json_extract(value, '$.kickoff'),
                json_extract(value, '$.takimlar'), json_extract(value, '$.veri')
           FROM json_each(?) WHERE true
       ON CONFLICT(mac_id) DO UPDATE SET kickoff = excluded.kickoff, takimlar = excluded.takimlar, veri = excluded.veri`,
    ).bind(JSON.stringify(kayitlar)),
    // Dosyadan cikarilan (iptal edilmis, yanlis girilmis, kadin futbolu diye elenmis) gelecek
    // maclari plandan sil — bildirimi gitmesin.
    env.DB.prepare('DELETE FROM plan WHERE kickoff > ? AND mac_id NOT IN (SELECT value FROM json_each(?))')
      .bind(simdi, JSON.stringify(kayitlar.map((k) => k.mac_id))),
    env.DB.prepare('DELETE FROM plan WHERE kickoff < ?').bind(simdi - 2 * 3_600_000),
    env.DB.prepare('DELETE FROM gonderilen WHERE ts < ?').bind(simdi - 3 * 86_400_000),
    env.DB.prepare('DELETE FROM gunluk_ozet WHERE ts < ?').bind(simdi - 3 * 86_400_000),
  ]);
  console.log('plan yenilendi', kayitlar.length, 'mac');
  return kayitlar.length;
}

// ─── Gonderim (mac/abone sayisindan bagimsiz sabit sorgu) ────────────────────

async function gonder(env, simdi) {
  const ust = simdi + HATIRLAT_DK * 60_000;

  // 1) Zamani gelen maclar
  const { results: maclar } = await env.DB.prepare(
    'SELECT mac_id, kickoff, veri FROM plan WHERE kickoff > ? AND kickoff <= ?',
  ).bind(simdi, ust).all();
  const vadeli = new Map(maclar.filter((m) => zamaniGeldiMi(m.kickoff, simdi)).map((m) => [m.mac_id, { ...m, veri: JSON.parse(m.veri) }]));
  if (vadeli.size === 0) return 0;

  // 2) Bu maclarin henuz bildirim almamis takipcileri — TEK sorgu
  const { results: ciftler } = await env.DB.prepare(
    `SELECT p.mac_id, a.token, a.dil, a.ulke, a.tz, a.dallar
       FROM plan p, json_each(p.takimlar) jt
       JOIN abone_takim t ON t.takim = jt.value
       JOIN aboneler a ON a.token = t.token
      WHERE p.kickoff > ? AND p.kickoff <= ?
        AND NOT EXISTS (SELECT 1 FROM gonderilen g WHERE g.mac_id = p.mac_id AND g.token = a.token)
      GROUP BY p.mac_id, a.token`,
  ).bind(simdi, ust).all();

  // Takim secimi spor dalini ayirmiyor (ayni adli kulubun basketbol maci futbol
  // favorisiyle eslesiyor). Kullanici kapattigi dalda bildirim almaz.
  const adaylar = ciftler.filter((c) =>
    vadeli.has(c.mac_id)
    && gorunurMu(vadeli.get(c.mac_id).veri, c.ulke)
    && dalIstendiMi(c.dallar, vadeli.get(c.mac_id).veri.sport));
  if (adaylar.length === 0) return 0;

  // 3) SAHIPLEN — satiri bu calisma yazabildiyse gonderim bu calismanin
  const { results: sahiplenen } = await env.DB.prepare(
    `INSERT OR IGNORE INTO gonderilen (mac_id, token, ts)
       SELECT json_extract(value, '$.m'), json_extract(value, '$.t'), ?
         FROM json_each(?) WHERE true
     RETURNING mac_id, token`,
  ).bind(simdi, JSON.stringify(adaylar.map((c) => ({ m: c.mac_id, t: c.token })))).all();
  const benim = new Set(sahiplenen.map((r) => `${r.mac_id} ${r.token}`));

  const mesajlar = adaylar
    .filter((c) => benim.has(`${c.mac_id} ${c.token}`))
    .map((c) => {
      const mac = vadeli.get(c.mac_id);
      return {
        to: c.token,
        ...bildirimIcerigi(mac.veri, mac.kickoff, c),
        sound: 'default',
        priority: 'high',
        ttl: Math.max(60, Math.floor((mac.kickoff - simdi) / 1000)),   // mac basladiysa gosterme
        data: { macId: c.mac_id },
      };
    });

  // 4) Gonder; basarisizlari birakip (tekrar denensin) olu cihazlari sil — toplu, en fazla 4 sorgu
  let basarili = 0;
  const birak = [];     // gecici hata: sahiplenmeyi geri al
  const olu    = [];    // DeviceNotRegistered
  for (let i = 0; i < mesajlar.length; i += EXPO_PARTI) {
    const parti = mesajlar.slice(i, i + EXPO_PARTI);
    const biletler = await expoyaGonder(env, parti);
    parti.forEach((m, j) => {
      const b = biletler?.[j];
      if (b?.status === 'ok') basarili++;
      else if (b?.details?.error === 'DeviceNotRegistered') olu.push(m.to);
      else {
        birak.push({ m: m.data.macId, t: m.to });
        if (b) console.log('expo bilet hatasi', m.data.macId, b.details?.error ?? b.message);
      }
    });
  }

  const temizlik = [];
  if (birak.length) {
    temizlik.push(env.DB.prepare(
      `DELETE FROM gonderilen WHERE (mac_id, token) IN
         (SELECT json_extract(value, '$.m'), json_extract(value, '$.t') FROM json_each(?))`,
    ).bind(JSON.stringify(birak)));
  }
  if (olu.length) {
    const liste = JSON.stringify([...new Set(olu)]);
    temizlik.push(
      env.DB.prepare('DELETE FROM abone_takim WHERE token IN (SELECT value FROM json_each(?))').bind(liste),
      env.DB.prepare('DELETE FROM aboneler WHERE token IN (SELECT value FROM json_each(?))').bind(liste),
      // sahiplenme satirlari da gitsin: teslim edilmedi, "gonderilen" sayilmamali
      env.DB.prepare('DELETE FROM gonderilen WHERE token IN (SELECT value FROM json_each(?))').bind(liste),
    );
  }
  if (temizlik.length) await env.DB.batch(temizlik);
  return basarili;
}

/** Abonenin yerel tarihi (YYYY-MM-DD) — ozet gunde bir kez gitsin diye anahtar. */
function yerelGun(ms, tz) {
  try {
    return new Date(ms).toLocaleDateString('en-CA', { timeZone: tz || 'UTC' });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Sabah ozeti: abonenin yerel saatiyle 09:00'da, o gun takip ettigi takimlarin
 * maclarini TEK bildirimde ozetler. 15 dk kala giden hatirlatma ayrica devam eder.
 * Ayni gun icin ikinci kez gitmez (gunluk_ozet sahiplenmesi).
 */
async function ozetGonder(env, simdi) {
  const { results: aboneler } = await env.DB.prepare(
    'SELECT token, dil, ulke, tz, dallar FROM aboneler',
  ).all();

  const uygun = aboneler
    .map((a) => ({ ...a, gun: yerelGun(simdi, a.tz) }))
    .filter((a) => {
      const [ss, dd] = yerelSaat(simdi, a.tz).split(':').map(Number);
      // Pencere testte genisletilebilir (wrangler --var); uretimde 15 dk.
      return ss === OZET_SAAT && dd < (Number(env.OZET_PENCERE_DK) || OZET_PENCERE_DK);
    });
  if (uygun.length === 0) return 0;

  // SAHIPLEN — ayni dakikada iki calisma varsa yalniz biri gonderir
  const { results: sahiplenen } = await env.DB.prepare(
    `INSERT OR IGNORE INTO gunluk_ozet (token, gun, ts)
       SELECT json_extract(value, '$.t'), json_extract(value, '$.g'), ?
         FROM json_each(?) WHERE true
     RETURNING token`,
  ).bind(simdi, JSON.stringify(uygun.map((a) => ({ t: a.token, g: a.gun })))).all();
  if (sahiplenen.length === 0) return 0;

  const benim = new Map(uygun.filter((a) => sahiplenen.some((r) => r.token === a.token)).map((a) => [a.token, a]));

  const { results: satirlar } = await env.DB.prepare(
    `SELECT p.mac_id, p.kickoff, p.veri, a.token
       FROM plan p, json_each(p.takimlar) jt
       JOIN abone_takim t ON t.takim = jt.value
       JOIN aboneler a ON a.token = t.token
      WHERE a.token IN (SELECT value FROM json_each(?))
        AND p.kickoff > ? AND p.kickoff <= ?
      GROUP BY p.mac_id, a.token`,
  ).bind(JSON.stringify([...benim.keys()]), simdi, simdi + GUN_MS).all();

  // Abone basina: kendi ulkesinde gorunen, dal tercihine uyan ve AYNI YEREL GUNDEKI maclar
  const kisiler = new Map();
  for (const r of satirlar) {
    const a = benim.get(r.token);
    if (!a) continue;
    const veri = JSON.parse(r.veri);
    if (!gorunurMu(veri, a.ulke)) continue;
    if (!dalIstendiMi(a.dallar, veri.sport)) continue;
    if (yerelGun(r.kickoff, a.tz) !== a.gun) continue;
    if (!kisiler.has(r.token)) kisiler.set(r.token, []);
    kisiler.get(r.token).push({ kickoff: r.kickoff, veri });
  }

  const mesajlar = [];
  for (const [token, maclar] of kisiler) {
    maclar.sort((x, y) => x.kickoff - y.kickoff);
    const a = benim.get(token);
    mesajlar.push({
      to: token,
      ...ozetIcerigi(maclar, a),
      sound: 'default',
      priority: 'normal',
      data: { ozet: a.gun },
    });
  }
  // Maci olmayan abone: sahiplenme satiri kalsin — bugun icin tekrar bakilmasin.
  if (mesajlar.length === 0) return 0;

  let basarili = 0;
  const birak = [];
  const olu   = [];
  for (let i = 0; i < mesajlar.length; i += EXPO_PARTI) {
    const parti = mesajlar.slice(i, i + EXPO_PARTI);
    const biletler = await expoyaGonder(env, parti);
    parti.forEach((m, j) => {
      const b = biletler?.[j];
      if (b?.status === 'ok') basarili++;
      else if (b?.details?.error === 'DeviceNotRegistered') olu.push(m.to);
      else {
        birak.push(m.to);   // gecici hata: sahiplenmeyi geri al, bir sonraki dakika tekrar denesin
        if (b) console.log('ozet bilet hatasi', m.to.slice(0, 24), b.details?.error ?? b.message);
      }
    });
  }

  const temizlik = [];
  if (birak.length) {
    temizlik.push(env.DB.prepare(
      'DELETE FROM gunluk_ozet WHERE token IN (SELECT value FROM json_each(?))',
    ).bind(JSON.stringify(birak)));
  }
  if (olu.length) {
    const liste = JSON.stringify([...new Set(olu)]);
    temizlik.push(
      env.DB.prepare('DELETE FROM abone_takim WHERE token IN (SELECT value FROM json_each(?))').bind(liste),
      env.DB.prepare('DELETE FROM aboneler WHERE token IN (SELECT value FROM json_each(?))').bind(liste),
      env.DB.prepare('DELETE FROM gunluk_ozet WHERE token IN (SELECT value FROM json_each(?))').bind(liste),
    );
  }
  if (temizlik.length) await env.DB.batch(temizlik);
  return basarili;
}

/** Abonenin dal tercihi; kayit eski surumdense (null) hepsi acik sayilir. */
function dalIstendiMi(ham, sport) {
  if (!ham) return true;
  try {
    const liste = JSON.parse(ham);
    return !Array.isArray(liste) || liste.length === 0 || liste.includes(sport ?? 'football');
  } catch {
    return true;
  }
}

/** Expo'ya bir parti yollar. Biletleri doner; ulasilamazsa null (hepsi tekrar denenir). */
async function expoyaGonder(env, mesajlar) {
  const basliklar = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env.EXPO_ACCESS_TOKEN) basliklar.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  try {
    const yanit = await fetch(env.EXPO_PUSH_URL, { method: 'POST', headers: basliklar, body: JSON.stringify(mesajlar) });
    if (!yanit.ok) { console.log('expo HTTP', yanit.status, await yanit.text()); return null; }
    return (await yanit.json()).data ?? null;
  } catch (e) {
    console.log('expo erisilemedi', String(e));
    return null;
  }
}
