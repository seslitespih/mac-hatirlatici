# Maç Hatırlatıcı — push bildirim sunucusu

Kullanıcı uygulamayı o gün açmasa da, takip ettiği takımın maçına 15 dakika kala bildirim gönderir.
Cloudflare Worker + D1 + Cron, gönderim Expo Push üzerinden. Hepsi ücretsiz planda çalışır.

Uygulama tarafı: `services/pushService.ts` (dal: `push-bildirim`, 1.4.3 / 297f921 üstüne).

## Nasıl çalışır

- **Kayıt** — uygulama `POST /kayit` ile push token, takımlar, dil, ülke ve saat dilimini yollar.
  Boş takım listesi = abonelik silinir.
- **Plan** — cron 10 dakikada bir `assets/matches-daily.json`'ı okur, önümüzdeki 6 saatin maçlarını
  `plan` tablosuna yazar. Dosyadan çıkarılan maç plandan da silinir.
- **Gönderim** — cron her dakika, başlamasına 15 dk veya daha az kalan maçları takip edenlere yollar.
  Aynı maç aynı cihaza iki kez gitmez (`gonderilen`). Expo `DeviceNotRegistered` derse abone silinir.
- **Görünürlük** — uygulamadaki kural birebir: kullanıcının ülkesinde kanal yoksa yalnız `global` maçlar.
- **Takım eşleştirme** — `src/takimlar.js`, uygulamanın `constants/teams.ts` dosyasından üretildi.
  Uygulamada adla eşleşmeyen kimlikleri (betis, leverkusen, acmilan…) sunucu yakalar.

## Test

```
npm test                    # saf mantık — bildirim metni uygulamadakiyle birebir
node test/entegrasyon.mjs   # uçtan uca: wrangler dev + yerel D1 + sahte Expo
```

## Kurulum (bir kez)

```
npx wrangler login                      # ya da CLOUDFLARE_API_TOKEN ortam değişkeni
npx wrangler d1 create mac-hatirlatici-push
#   → çıkan database_id'yi wrangler.toml'a yaz
npx wrangler d1 execute mac-hatirlatici-push --remote --file=schema.sql
npx wrangler deploy
#   → çıkan https://mac-hatirlatici-push.<hesap>.workers.dev adresini
#     uygulamadaki services/pushService.ts → PUSH_API_URL'e yaz
curl https://mac-hatirlatici-push.<hesap>.workers.dev/saglik
```

iOS teslimi için Expo projesine APNs anahtarı (.p8) yüklenmiş olmalı: expo.dev → proje → Credentials.

## İzleme

```
npx wrangler tail           # canlı log: "plan yenilendi N mac", expo hataları
```
