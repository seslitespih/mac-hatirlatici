# Günlük Maç İçeriği Hattı

Her gece **Türkiye saatiyle 01:00**'de Claude'a web araması açık tek bir toplu
soru sorulur; yanıt doğrulanıp `assets/matches-daily.json` dosyasına yazılır ve
repoya push'lanır. Uygulama bu dosyayı GitHub raw üzerinden okur — yani **yeni
lig, yeni spor dalı veya kanal düzeltmesi uygulama güncellemesi gerektirmez.**

## Parçalar

| Dosya | Ne işe yarar |
|---|---|
| `scripts/fixtures-prompt.md` | Claude'a sorulan **not defteri**. Serbestçe düzenlenebilir, kod değişmez. |
| `scripts/fixtures-config.json` | Ülkeler + saat dilimleri + diller + taranacak lig/turnuva listesi. |
| `scripts/generate-fixtures.mjs` | Çağrıyı yapar, doğrular, JSON'u yazar. |
| `.github/workflows/daily-fixtures.yml` | 22:00 UTC (= TR 01:00) cron + manuel tetikleme. |
| `assets/matches-daily.json` | Üretilen çıktı — uygulamanın okuduğu dosya. |
| `services/dailyMatchService.ts` | Uygulama tarafı: dosyayı çeker, yerel saate çevirir, TheSportsDB ile birleştirir. |

## Kurulum (tek seferlik)

1. [console.anthropic.com](https://console.anthropic.com) → API key oluştur.
2. GitHub'da repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Secret: anahtar
3. **Actions → Daily Fixtures (Claude) → Run workflow** ile elle bir kez çalıştır,
   çıktıyı `assets/matches-daily.json` içinde incele.

## Tasarım kararları — neden böyle

- **Tek istek, 38 ülke.** Maç listesi evrenseldir; ülkeye göre değişen yalnızca
  saat ve kanaldır. 38 ayrı soru hem pahalı hem tutarsız olurdu.
- **Model yalnızca UTC verir.** Yerel saate çevirimi uygulama `Intl` ile yapar.
  Modele 38 saat dilimi çevirisi yaptırmak en büyük hata kaynağıdır.
- **Web araması zorunlu.** Fikstür ve yayın hakları ezberden bilinemez; grounding
  olmadan makul görünen ama yanlış veri üretilir.
- **`confidence: "low"` yayına alınmaz.** Emin olunmayan kanal, boş kanaldan kötüdür.
- **±36 saat sapma filtresi.** Hedef günden uzaktaki kayıt halüsinasyon sayılır, elenir.
- **Üretim başarısızsa eski dosya korunur.** Doğrulamadan geçen maç yoksa script
  hata verip çıkar, `matches-daily.json` yerinde kalır.
- **TheSportsDB yerinde kaldı.** Uzak kaynak bir gün üretilemezse uygulama boş
  kalmaz; iki kaynak `mergeMatchSources` ile birleşir, canlı skor durumu
  TheSportsDB'den devralınır.

## Yerel çalıştırma

```bash
npm install --no-save @anthropic-ai/sdk
ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-fixtures.mjs --dry-run
ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-fixtures.mjs --date 2026-07-26
```

`--dry-run` çıktıyı ekrana basar, dosyaya yazmaz.

## Kapsamı genişletmek

Yeni lig eklemek için `fixtures-config.json` → `coverage` altına bir satır yaz.
Yeni ülke eklemek için `countries` altına ekle **ve** `services/sportsDbService.ts`
içindeki `COUNTRY_TZ` haritasına aynı ülkeyi ekle (uygulama saat dilimini oradan okur).
