// Uygulama geri bildirimi → Esat'ın e-postası.
// Maç Hatırlatıcı ve Vocal Tasbeeh (Sesli Tespih) "Öneri / sorun bildir" formu buraya POST eder:
//   POST /gonder  {app, message, email?, platform?, version?, lang?, country?}
// Cloudflare Email Routing'in send_email bağlantısıyla doğrulanmış adrese (ssaglamess@gmail.com)
// mail atar. Ücretsiz; alan adı sportstvtoday.com aynı Cloudflare hesabında.

import { EmailMessage } from "cloudflare:email";

export const UYGULAMALAR = { mac: "Maç Hatırlatıcı", tespih: "Vocal Tasbeeh" };
const GONDEREN = "geribildirim@sportstvtoday.com";
const ALICI = "ssaglamess@gmail.com";
const EN_UZUN = 4000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function yanit(veri, durum = 200) {
  return new Response(JSON.stringify(veri), {
    status: durum,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

const kisa = (v, n) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

/** Gelen gövdeyi doğrular; hata varsa {hata}, yoksa temizlenmiş alanları döner. */
export function dogrula(b) {
  if (!b || typeof b !== "object") return { hata: "json" };
  const uygulama = UYGULAMALAR[b.app];
  if (!uygulama) return { hata: "app" };
  const mesaj = String(b.message ?? "").replace(/\r\n/g, "\n").trim().slice(0, EN_UZUN);
  if (mesaj.length < 2) return { hata: "message" };
  let eposta = kisa(b.email, 200);
  if (eposta && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(eposta)) eposta = "";
  return {
    app: b.app,
    uygulama,
    mesaj,
    eposta,
    platform: kisa(b.platform, 20),
    surum: kisa(b.version, 30),
    dil: kisa(b.lang, 10),
    ulke: kisa(b.country, 10),
  };
}

// RFC 2047 başlık kodlaması (Türkçe/Arapça konu satırı için)
const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
};
const baslik = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

/** Ham MIME metni üretir (Cloudflare send_email ham ileti ister). */
export function mimeOlustur(v, { cfUlke = "", zaman = new Date() } = {}) {
  const ayrinti = [v.platform, v.surum, v.dil].filter(Boolean).join(" · ");
  const konu = `[${v.uygulama}] Geri bildirim${ayrinti ? ` (${ayrinti})` : ""}`;
  const trSaat = zaman.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const govde = [
    v.mesaj,
    "",
    "———",
    `Uygulama : ${v.uygulama}`,
    `Platform : ${v.platform || "?"}`,
    `Sürüm    : ${v.surum || "?"}`,
    `Dil      : ${v.dil || "?"}`,
    `Ülke     : ${v.ulke || cfUlke || "?"}`,
    `E-posta  : ${v.eposta || "(yazmadı — cevap verilemez)"}`,
    `Zaman    : ${trSaat} (TR)`,
    "",
    v.eposta ? "Cevap vermek için bu maile \"Yanıtla\" demen yeterli." : "",
  ].join("\n");

  const satirlar = [
    `From: ${baslik(v.uygulama + " geri bildirim")} <${GONDEREN}>`,
    `To: <${ALICI}>`,
    `Subject: ${baslik(konu)}`,
    `Message-ID: <${crypto.randomUUID()}@sportstvtoday.com>`,
    `Date: ${zaman.toUTCString().replace("GMT", "+0000")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (v.eposta) satirlar.push(`Reply-To: <${v.eposta}>`);
  const govdeB64 = b64(govde).replace(/.{76}/g, "$&\r\n");
  return { konu, ham: satirlar.join("\r\n") + "\r\n\r\n" + govdeB64 + "\r\n" };
}

export default {
  async fetch(req, env) {
    const yol = new URL(req.url).pathname;
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method === "GET" && yol === "/") return yanit({ ok: true, servis: "geri-bildirim" });
    if (req.method !== "POST" || yol !== "/gonder") return yanit({ ok: false, hata: "yol" }, 404);

    const ip = req.headers.get("CF-Connecting-IP") || "?";
    if (env.SINIR) {
      const { success } = await env.SINIR.limit({ key: ip });
      if (!success) return yanit({ ok: false, hata: "cok-sik" }, 429);
    }

    let govde;
    try {
      govde = await req.json();
    } catch {
      return yanit({ ok: false, hata: "json" }, 400);
    }
    const v = dogrula(govde);
    if (v.hata) return yanit({ ok: false, hata: v.hata }, 400);

    const { ham } = mimeOlustur(v, { cfUlke: req.cf?.country || "" });
    try {
      await env.POSTA.send(new EmailMessage(GONDEREN, ALICI, ham));
    } catch (e) {
      console.error("posta gonderilemedi", e?.message || e);
      return yanit({ ok: false, hata: "posta" }, 502);
    }
    return yanit({ ok: true });
  },
};
