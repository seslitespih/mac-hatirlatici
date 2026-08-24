# Günlük Fikstür Üretimi — Tam Talimat

Bu dosya **kendi kendine yeterlidir**. Sıfır bağlamla gelen bir ajan yalnızca bunu ve
`scripts/broadcast-rights.json`'ı okuyarak işi yapabilmelidir.

**Çıktı:** `assets/matches-daily.json` — iOS uygulaması, Android uygulaması ve
sportstvtoday.com sitesi aynı anda bu dosyadan beslenir. Uygulama güncellemesi/build
GEREKMEZ; push yeterlidir.

---

## 1. Kaynaklar

Hepsi doğrudan çekilebilir. `broadcast-rights.json` → `kaynaklar.ulkeler` da aynı listeyi tutar.

| Ülke | Adres | Saat dilimi | Not |
|---|---|---|---|
| TR | `https://hangikanalda.app/api/proxy/matches` | **İstanbul UTC+3** | **JSON API — `curl` ile çek.** Sayfayı çekme, JS ile yükleniyor. |
| DE | `https://www.fotmob.com/de/tv-guide/de` | **UTC** | Bota UTC verir |
| ES | `https://www.futbolenlatv.es/` | Madrid UTC+2 (yaz) | |
| FR | `https://www.programmefoot.com/` | Paris UTC+2 (yaz) | |
| GB | `https://www.live-footballontv.com/` | Londra UTC+1 (yaz) | |
| AR | `https://www.tvenvivo.com.ar/` | UTC−3 | |
| BR | `https://www.futebolnatv.com.br/` | Brasília UTC−3 | Yaz saati YOK (2019'da kalktı) |
| MENA | `https://sporsat.com/ar` | **UTC** (bota) | Arapça: `م`=PM, `ص`=AM |
| US | `https://worldsoccertalk.com/upcoming-matches/` | ET UTC−4 (yaz) | **Sayfa ÖNCE dünü listeler** — istekte "dünü atla, sadece \<bugün\> başlığını listele" de |
| CA | `https://www.goal.com/en-ca/sports-events/soccer` | ziyaretçinin dilimi | DNS çözülmüyor, atlanabilir. Kanalları dar: Fubo / TSN+ |

### KULLANILMAYACAK kaynaklar

- `jogostv.com.br` — **sitenin kendisi bir gün geride.** Yerine futebolnatv.
- `tvfussball.de` — bota eski sayfa (09.08) veriyor; ayrıca Premier Lig'e "beIN Sports" yazıyor
  (Almanya'da beIN yok, PL 2030/31'e kadar Sky'da münhasır). Yerine FotMob.
- `hangikanalda.com` — yanlış alan adı, doğrusu `.app`.

### Saat dilimi kuralı

**Dilimi sitenin ülkesinden değil, veriyi nasıl aldığından çıkar.** Sporsat ve FotMob
"ziyaretçinin saatiyle" gösterir; bot olarak çekince **UTC** gelir. Aynı sayfayı bir insan
tarayıcıdan kopyalarsa kendi saatiyle gelir. Şüphedeysen: birkaç maçı başka bir kaynakla
karşılaştır, tutuyorsa dilim doğrudur.

---

## 2. Akış

1. **Dokuz kaynağı çek.** Her birinin tarihini doğrula — beklenen günü göstermiyorsa O KAYNAĞI KULLANMA
   ve raporda belirt.
2. **Maç kümesini birleştir.** Aynı maç birden çok kaynakta çıkar; ev/deplasman adlarına göre eşleştir.
3. **Saatleri UTC'ye çevir.** Bir maç iki kaynakta farklı saat veriyorsa DURDUR ve raporda yaz — girme.
4. **Kanalları ülke ülke yaz.** Her ülkenin kanalı KENDİ kaynağından gelir.
   Kaynağı olmayan ülke için `broadcast-rights.json` tabanını kullan.
5. **`broadcast-rights.json` → `bolunmeler` kurallarını uygula** (DE, IT, ES, GB, BR'de maç bazında değişir).
6. **Kaynak tabloyla çelişiyorsa:** günlük kaynak o günün kanalı için otoritedir — AMA tablo
   `durum: dogrulandi` ve çelişki büyükse (ör. o ülkede o yayıncı hiç yok) raporda belirt, körlemesine yazma.
7. Doğrula, commit, push.

---

## 3. Hangi maçlar girer

**Girer:** büyük Avrupa ligleri ve kupaları · UEFA turnuvaları · Türkiye Süper Lig / 1. Lig / Türkiye Kupası ·
Brasileirão A ve B · Copa do Brasil · Libertadores · Sudamericana · Arjantin Primera División ·
Suudi Pro Lig · MLS · Liga MX · A milli takım maçları · voleybol ve basketbolda büyük turnuvalar.

**Girmez:** bitmiş maçlar (`Tamamlandı` / `FIN` / `انتهت`) · rezerv ve altyapı ligleri
(Torneo Proyección, U21, Primera B/C) · kadın kulüp ligleri (kadın MİLLİ takım turnuvaları girer) ·
ülke listesinde olmayan niş ligler (İzlanda, Letonya vb.).

⚠️ **Gece yarısını aşan maçlar.** Arjantin/Brezilya maçları UTC'de ertesi güne taşabilir
(ör. 21:15 ART = ertesi gün 00:15 UTC). Bunlar YİNE BUGÜNÜN dosyasına girer — `date` alanı değişmez.
Buna karşılık TR kaynağındaki 00:30 / 01:15 gibi saatler **dünün bitmiş maçlarıdır**, alma.

---

## 4. `tier` kuralı

`global` = her ülkede görünür · `regional` = yalnız `broadcasts` içinde kanalı olan ülkelerde.

- **Ligler turnuvaya göre:** dünya çapında takip edilenler `global` (Premier Lig, LaLiga, Serie A,
  Bundesliga, Ligue 1, Liga Portugal, Süper Lig, Şampiyonlar/Avrupa/Konferans Ligi, Suudi Pro Lig,
  Brasileirão Série A, DFB Pokal, Coppa Italia). Niş yerel ligler `regional`
  (TFF 1. Lig, LaLiga Hypermotion, Ligue 2, Série B, Arjantin Primera División, Liga MX, USL, Azerbaycan PL).
- **Kupalar sahadaki takıma göre:** Suudi Kral Kupası varsayılan `regional`, ama
  Al-Nassr / Al-Hilal / Al-Ittihad / Al-Ahli oynuyorsa `global`.

🔴 **`regional` + boş `broadcasts` = maç HİÇBİR YERDE görünmez.** Kanal bulamıyorsan ya kanalı bul
ya maçı hiç ekleme. Aynı şekilde `global` + çok az ülke = çoğu kullanıcıda "Yayın bilgisi yok" çıkar.

---

## 5. Dosya şeması

```json
{
 "generated_at": "2026-08-24T08:00:00.000Z",
 "date": "2026-08-24",
 "model": "user-provided",
 "stats": {"total": 39, "withChannel": 39, "bySport": {"football": 28}, "warnings": 0, "searches": 0},
 "matches": [{
   "id": "football-20260824-fulham-chelsea",
   "sport": "football | volleyball | basketball | motorsport",
   "competitionId": "premier",
   "tier": "global",
   "competition": {"tr":"","en":"","de":"","es":"","fr":"","it":"","pt":"","ar":""},
   "home": "Fulham", "away": "Chelsea",
   "kickoffUtc": "2026-08-24T19:00:00Z",
   "broadcasts": {"TR": ["beIN Sports 3"], "GB": ["Sky Sports Main Event"]},
   "sources": []
 }]
}
```

- `competition` **sekiz dilin hepsini** içermeli — eksik dil uygulamada `competitionId` gösterir.
  Mevcut dosyadaki bir maçtan kopyala; yeni turnuvaysa sekizini de yaz.
- `id` biçimi: `<spor>-<YYYYMMDD>-<ev>-<deplasman>`, küçük harf, tire ayraçlı.
- `kickoffUtc` **Z ile bitmeli**.
- Maçları `kickoffUtc`'ye göre sırala.
- Dosyayı **1 boşluk girintiyle** ve `ensure_ascii=False` ile yaz (mevcut biçim böyle).

### Kanal adı yazımı

Kaynaklar özensiz yazıyor. Marka yazımına çevir:
`Bein Sports` → **beIN Sports** · `CEV Youtube` → **CEV YouTube** · `Caze TV` → **CazéTV**

---

## 6. Yazmadan önceki güvenlik kontrolleri

Bunlardan biri bile başarısızsa **dosyayı yazma**, durumu raporla:

1. JSON geçerli mi.
2. `regional` + boş `broadcasts` olan maç var mı → olmamalı.
3. Sekiz dili eksik `competition` var mı → olmamalı.
4. **Gerileme kontrolü:** yeni maç sayısı, aynı güne ait mevcut dosyanın maç sayısının
   **%70'inden az** mı, ya da kapsanan ülke sayısı azaldı mı? Öyleyse muhtemelen kaynak(lar)
   çekilememiştir — **mevcut dosyayı EZME**, raporla.
5. Dokuz kaynaktan **en az altısı** başarıyla çekildi mi.

Aynı gün içinde tekrar çalışırken mevcut dosya **zenginleştirilir, sıfırdan yazılmaz**:
mevcut kanalları koru, yalnız eksikleri doldur ve biten maçları çıkar.

---

## 7. Push

```
git add assets/matches-daily.json
git commit -m "<gün> fiksturu: <n> mac, <k> ulke"
git fetch origin && git rebase origin/main   # channels-daily.json'a otomatik commit atan bir iş var
git push origin HEAD
```

Build/deploy gerekmez.

---

## 8. Bilinen hak durumları (özet — ayrıntı `broadcast-rights.json`'da)

- **Premier Lig Almanya:** Sky münhasır, 2030/31'e kadar. beIN Almanya'da yok.
- **LaLiga Fransa:** 15 Ağu 2026'dan beri DAZN + Disney+; beIN dönemi bitti. İkisi de 10 maçın tamamını verir.
- **Şampiyonlar Ligi Brezilya:** Max (204 maçın tamamı) + TNT/Space. Disney+ **değil**.
- **Sudamericana Brezilya:** ESPN/Disney+. Libertadores Brezilya: Globo/Paramount+. Ayrı paketler.
- **DFB Pokal Almanya:** RTL/RTL+ açık TV + Sky Sport/WOW; tur başına seçili maç ARD/ZDF'de.
- **Liga Portugal'ın MENA yayıncısı YOK.**
- **Brezilya hiçbir bölge kısayoluna dahil değil** — her turnuvada BR'yi açıkça yaz.
- Brezilya Série A hakları **kulüp bloğuna** göre bölünür: LFU kulüpleri (Athletico-PR, Botafogo,
  Chapecoense, Corinthians, Coritiba, Cruzeiro, Fluminense, Internacional, Mirassol, Vasco) →
  Amazon Prime / Record / CazéTV; LIBRA kulüpleri → Globo / SporTV / Premiere.
