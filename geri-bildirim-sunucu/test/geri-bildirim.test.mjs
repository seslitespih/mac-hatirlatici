import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// "cloudflare:email" yalnız Workers'ta var; testte boş bir kopya yükle.
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s, c, n) {
    if (s === "cloudflare:email") return { url: "data:text/javascript,export class EmailMessage{}", shortCircuit: true };
    return n(s, c);
  }`));
const { dogrula, mimeOlustur } = await import("../src/index.js");

const cozB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));

test("bilinmeyen uygulama ve boş mesaj reddedilir", () => {
  assert.equal(dogrula({ app: "x", message: "merhaba" }).hata, "app");
  assert.equal(dogrula({ app: "mac", message: "  " }).hata, "message");
  assert.equal(dogrula(null).hata, "json");
});

test("geçersiz e-posta atılır, başlık enjeksiyonu engellenir", () => {
  assert.equal(dogrula({ app: "mac", message: "ok ok", email: "yok" }).eposta, "");
  const v = dogrula({ app: "mac", message: "ok ok", email: "a@b.com\r\nBcc: x@y.com" });
  assert.ok(!/[\r\n]/.test(v.eposta));
  assert.equal(dogrula({ app: "tespih", message: "ok", email: "a@b.co" }).eposta, "a@b.co");
});

test("MIME: Türkçe/Arapça konu kodlanır, gövde geri çözülür, Reply-To eklenir", () => {
  const v = dogrula({
    app: "tespih", message: "التطبيق بطيء جدا\nçok yavaş", email: "kisi@ornek.com",
    platform: "android", version: "1.5.4", lang: "ar",
  });
  const { ham, konu } = mimeOlustur(v, { cfUlke: "DZ", zaman: new Date("2026-11-10T12:00:00Z") });
  assert.match(konu, /\[Vocal Tasbeeh\] Geri bildirim \(android · 1\.5\.4 · ar\)/);
  assert.match(ham, /^Subject: =\?UTF-8\?B\?/m);
  assert.match(ham, /^Reply-To: <kisi@ornek\.com>$/m);
  assert.match(ham, /^Message-ID: </m);
  const govde = cozB64(ham.split("\r\n\r\n")[1]);
  assert.match(govde, /التطبيق بطيء جدا/);
  assert.match(govde, /Ülke     : DZ/);
  assert.match(govde, /Zaman    : 10\.11\.2026 15:00:00 \(TR\)/);
});

test("e-posta yoksa Reply-To yok", () => {
  const { ham } = mimeOlustur(dogrula({ app: "mac", message: "Lens yok" }));
  assert.doesNotMatch(ham, /Reply-To/);
});
