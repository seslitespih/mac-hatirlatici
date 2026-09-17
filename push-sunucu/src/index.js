// Mac Hatirlatici — push bildirim sunucusu (Cloudflare Worker + D1 + Cron)
//
// NEDEN: uygulama yerel bildirimleri yalniz ACILDIGINDA kuruyordu; kullanici o gun
// uygulamayi acmazsa bildirim gelmiyordu. Bu sunucu kullanicinin takimlarini bilir ve
// maca 15 dk kala Expo Push ile bildirimi kendisi gonderir.
//
// AKIS
//   POST /kayit          uygulama: push token + takimlar + dil + ulke + saat dilimi
//   cron (her dakika)    10 dk'da bir: fikstur dosyasini oku -> `plan` tablosunu yenile
//                        her dakika:   zamani gelen maclar -> takipcilere gonder
//   GET  /saglik         sayilar (token/takim bilgisi DONMEZ)
//
// JSON'u her dakika ayristirmiyoruz: ucretsiz planda istek basina CPU siniri dusuk.
// Agir is (ayristirma) 10 dk'da bir; dakikalik is yalniz D1 sorgusu.

import { planKaydi, zamaniGeldiMi, gorunurMu, bildirimIcerigi, kayitDogrula, HATIRLAT_DK } from './icerik.js';

const PLAN_UFKU_MS  = 6 * 60 * 60 * 1000;   // simdiden 6 saat sonrasina kadarki maclar
const EXPO_PARTI    = 100;                   // Expo tek istekte en fazla 100 mesaj alir
const JSON_SINIR    = 8 * 1024;

const json = (veri, durum = 200) =>
  new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': 'application/json' } });

export default {
  async fetch(istek, env) {
    const url = new URL(istek.url);

    if (istek.method === 'POST' && url.pathname === '/kayit') {
      const ham = await istek.text();
      if (ham.length > JSON_SINIR) return json({ hata: 'cok buyuk' }, 413);
      let govde;
      try { govde = JSON.parse(ham); } catch { return json({ hata: 'json degil' }, 400); }
      const { deger, hata } = kayitDogrula(govde);
      if (hata) return json({ hata }, 400);
      await kaydet(env, deger);
      return json({ ok: true });
    }

    if (istek.method === 'GET' && url.pathname === '/saglik') {
      const [a, p, g] = await env.DB.batch([
        env.DB.prepare('SELECT COUNT(*) AS n FROM aboneler'),
        env.DB.prepare('SELECT COUNT(*) AS n, MIN(kickoff) AS ilk, MAX(kickoff) AS son FROM plan'),
        env.DB.prepare('SELECT COUNT(*) AS n FROM gonderilen WHERE ts > ?').bind(Date.now() - 86_400_000),
      ]);
      return json({
        ok: true,
        abone: a.results[0].n,
        plan: p.results[0].n,
        planIlk: p.results[0].ilk ? new Date(p.results[0].ilk).toISOString() : null,
        planSon: p.results[0].son ? new Date(p.results[0].son).toISOString() : null,
        gonderilen24s: g.results[0].n,
      });
    }

    return json({ hata: 'bulunamadi' }, 404);
  },

  async scheduled(olay, env, ctx) {
    const simdi = olay.scheduledTime;
    const dakika = new Date(simdi).getUTCMinutes();
    if (dakika % 10 === 0 || (await planBosMu(env))) {
      await planYenile(env, simdi);
    }
    await gonder(env, simdi);
  },
};

// ─── Kayit ───────────────────────────────────────────────────────────────────

async function kaydet(env, k) {
  const silTakim = env.DB.prepare('DELETE FROM abone_takim WHERE token = ?').bind(k.token);

  // Takip birakildi -> tamamen sil; sunucu bu cihaza bir daha gondermez.
  if (k.takimlar.length === 0) {
    await env.DB.batch([silTakim, env.DB.prepare('DELETE FROM aboneler WHERE token = ?').bind(k.token)]);
    return;
  }

  const ifadeler = [
    env.DB.prepare(
      `INSERT INTO aboneler (token, dil, ulke, tz, platform, guncelleme) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET dil = excluded.dil, ulke = excluded.ulke, tz = excluded.tz,
         platform = excluded.platform, guncelleme = excluded.guncelleme`,
    ).bind(k.token, k.dil, k.ulke, k.tz, k.platform, Date.now()),
    silTakim,
    ...k.takimlar.map((t) => env.DB.prepare('INSERT INTO abone_takim (token, takim) VALUES (?, ?)').bind(k.token, t)),
  ];
  await env.DB.batch(ifadeler);   // D1 batch tek islem (transaction) olarak calisir
}

// ─── Plan ────────────────────────────────────────────────────────────────────

async function planBosMu(env) {
  const r = await env.DB.prepare('SELECT 1 FROM plan LIMIT 1').first();
  return !r;
}

async function planYenile(env, simdi) {
  let dosya;
  try {
    const yanit = await fetch(env.FIKSTUR_URL, { cf: { cacheTtl: 60 } });
    if (!yanit.ok) { console.log('fikstur alinamadi', yanit.status); return; }
    dosya = await yanit.json();
  } catch (e) {
    console.log('fikstur okunamadi', String(e));
    return;   // hata durumunda mevcut plana DOKUNMA
  }

  const kayitlar = (dosya.matches ?? [])
    .map(planKaydi)
    .filter((k) => k && k.kickoff > simdi && k.kickoff <= simdi + PLAN_UFKU_MS);

  const ifadeler = kayitlar.map((k) =>
    env.DB.prepare(
      `INSERT INTO plan (mac_id, kickoff, takimlar, veri) VALUES (?, ?, ?, ?)
       ON CONFLICT(mac_id) DO UPDATE SET kickoff = excluded.kickoff, takimlar = excluded.takimlar, veri = excluded.veri`,
    ).bind(k.mac_id, k.kickoff, JSON.stringify(k.takimlar), JSON.stringify(k.veri)),
  );

  // Dosyadan cikarilan (iptal edilmis, yanlis girilmis, kadin futbolu diye elenmis)
  // gelecek maclari plandan sil — bildirimi gitmesin.
  ifadeler.push(
    env.DB.prepare('DELETE FROM plan WHERE kickoff > ? AND mac_id NOT IN (SELECT value FROM json_each(?))')
      .bind(simdi, JSON.stringify(kayitlar.map((k) => k.mac_id))),
    env.DB.prepare('DELETE FROM plan WHERE kickoff < ?').bind(simdi - 2 * 3_600_000),
    env.DB.prepare('DELETE FROM gonderilen WHERE ts < ?').bind(simdi - 3 * 86_400_000),
  );
  await env.DB.batch(ifadeler);
  console.log('plan yenilendi', kayitlar.length, 'mac');
}

// ─── Gonderim ────────────────────────────────────────────────────────────────

async function gonder(env, simdi) {
  const { results: maclar } = await env.DB.prepare(
    'SELECT mac_id, kickoff, takimlar, veri FROM plan WHERE kickoff > ? AND kickoff <= ?',
  ).bind(simdi, simdi + HATIRLAT_DK * 60_000).all();

  for (const mac of maclar) {
    if (!zamaniGeldiMi(mac.kickoff, simdi)) continue;
    const veri = JSON.parse(mac.veri);

    const { results: aboneler } = await env.DB.prepare(
      `SELECT DISTINCT a.token, a.dil, a.ulke, a.tz
         FROM abone_takim t JOIN aboneler a ON a.token = t.token
        WHERE t.takim IN (SELECT value FROM json_each(?))
          AND NOT EXISTS (SELECT 1 FROM gonderilen g WHERE g.mac_id = ? AND g.token = a.token)`,
    ).bind(mac.takimlar, mac.mac_id).all();

    const mesajlar = aboneler
      .filter((a) => gorunurMu(veri, a.ulke))
      .map((a) => ({
        to: a.token,
        ...bildirimIcerigi(veri, mac.kickoff, a),
        sound: 'default',
        priority: 'high',
        ttl: Math.max(60, Math.floor((mac.kickoff - simdi) / 1000)),   // mac basladiysa gosterme
        data: { macId: mac.mac_id },
      }));

    for (let i = 0; i < mesajlar.length; i += EXPO_PARTI) {
      await expoyaGonder(env, mac.mac_id, mesajlar.slice(i, i + EXPO_PARTI), simdi);
    }
  }
}

async function expoyaGonder(env, macId, mesajlar, simdi) {
  const basliklar = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env.EXPO_ACCESS_TOKEN) basliklar.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;

  let biletler;
  try {
    const yanit = await fetch(env.EXPO_PUSH_URL, { method: 'POST', headers: basliklar, body: JSON.stringify(mesajlar) });
    if (!yanit.ok) { console.log('expo HTTP', yanit.status, await yanit.text()); return; }   // sonraki dakika tekrar denenir
    biletler = (await yanit.json()).data ?? [];
  } catch (e) {
    console.log('expo erisilemedi', String(e));
    return;
  }

  const ifadeler = [];
  biletler.forEach((bilet, i) => {
    const token = mesajlar[i]?.to;
    if (!token) return;
    if (bilet.status === 'ok') {
      ifadeler.push(env.DB.prepare('INSERT OR IGNORE INTO gonderilen (mac_id, token, ts) VALUES (?, ?, ?)').bind(macId, token, simdi));
    } else if (bilet.details?.error === 'DeviceNotRegistered') {
      // Uygulama silinmis ya da bildirim kalici olarak kapatilmis
      ifadeler.push(
        env.DB.prepare('DELETE FROM abone_takim WHERE token = ?').bind(token),
        env.DB.prepare('DELETE FROM aboneler WHERE token = ?').bind(token),
      );
    } else {
      console.log('expo bilet hatasi', macId, bilet.details?.error ?? bilet.message);
    }
  });
  if (ifadeler.length) await env.DB.batch(ifadeler);
}
