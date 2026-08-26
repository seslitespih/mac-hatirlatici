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
| AR | `https://tvenvivo.com.ar/` | UTC−3 | |
| BR | `https://www.futebolnatv.com.br/` | Brasília UTC−3 | Yaz saati YOK (2019'da kalktı) |
| MENA | `https://sporsat.com/ar` | **UTC** (bota) | Arapça: `م`=PM, `ص`=AM |
| US | `https://worldsoccertalk.com/upcoming-matches/` | ET UTC−4 (yaz) | **Sayfa ÖNCE dünü listeler** — istekte "dünü atla, sadece \<bugün\> başlığını listele" de |
| CA | `https://www.goal.com/en-ca/sports-events/soccer` | ziyaretçinin dilimi | **`curl` ile çek** — WebFetch DNS hatası verir, curl sorunsuz. Kanallar dar: Fubo / TSN+ |

### KULLANILMAYACAK kaynaklar

- `jogostv.com.br` — **sitenin kendisi bir gün geride.** Yerine futebolnatv.
- `tvfussball.de` — bota eski sayfa (09.08) veriyor; ayrıca Premier Lig'e "beIN Sports" yazıyor
  (Almanya'da beIN yok, PL 2030/31'e kadar Sky'da münhasır). Yerine FotMob.
- `hangikanalda.com` — yanlış alan adı, doğrusu `.app`.

### ⏰ Gece çalışmasında geç dönen kaynaklar

**AR (tvenvivo), BR (futebolnatv) ve MENA (sporsat) günlerini geç çeviriyor.**
25 Ağu 01:07 çalışmasında üçü de hâlâ 24 Ağustos'u gösteriyordu; sabah 08:00'de üçü de
güncelydi. Sonuç: gece çalışması Güney Amerika maçlarını komple kaçırdı
(Libertadores çeyrek finali, Copa do Brasil, iki Série B maçı).

**Kural:** gece 01:07 çalışmasında bu üçü eski tarih gösteriyorsa kullanma —
ama **07:07 ve 13:07 çalışmalarında mutlaka tekrar dene.** O saatlerde güncel olurlar.

### Saat dilimi kuralı

**Dilimi sitenin ülkesinden değil, veriyi nasıl aldığından çıkar.** Sporsat ve FotMob
"ziyaretçinin saatiyle" gösterir; bot olarak çekince **UTC** gelir. Aynı sayfayı bir insan
tarayıcıdan kopyalarsa kendi saatiyle gelir. Şüphedeysen: birkaç maçı başka bir kaynakla
karşılaştır, tutuyorsa dilim doğrudur.

---

## 2. Akış

1. **On kaynağı çek.** Her birinin tarihini doğrula — beklenen günü göstermiyorsa O KAYNAĞI KULLANMA
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

## 2b. 🔴 GÜN SINIRI — bu kural her şeyi belirler

**`matches-daily.json` yalnızca BUGÜNÜ ve BU GECEYİ içerir.** Yarının programını KOYMA.

Kesme noktası: **yarın 03:00 UTC** (= İstanbul 06:00). Bundan öncesi girer, sonrası girmez.
Böylece gece yarısını aşan maçlar (Güney Amerika 00:30–02:45 UTC) kalır — takvimde yarına
düşseler de izleyici için bu gecedir — ama yarının akşam programı görünmez.

Sebebi: yayındaki iOS/Android sürümü (1.4.3) **yarın 23:59'a kadar** olan pencereyi
gösteriyor (`utils/timezone.ts`). Kullanıcı uygulamada yarının maçlarını görmek istemiyor
ve bu ancak dosya tarafından çözülebilir — kod değişikliği build gerektirir.
(Kodda pencere ertesi sabah 06:00'a çekildi ama **henüz yayınlanmadı**.)

### Yarının verisi çöpe gitmez: `assets/matches-next.json`

Yarın için toplanan maçlar bu ayrı dosyaya yazılır. **Uygulama ve site bu dosyayı OKUMAZ.**
Ertesi gün ilk çalışmada içeriği `matches-daily.json`'a taşı, sonra `matches` dizisini boşalt.
Gece üretim yapılamazsa (dizüstü fişsiz, pil bitmiş) sabah bu dosya hazır veri sağlar.

- `date` alanına **bugünün** tarihini yaz.
- `id` içindeki tarih her maçın **kendi** gününü taşısın.
- Gerileme kontrolünü yalnız `matches-daily.json` üzerinden yap.

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

### 🔴 Takım adları: `home`/`away` ASCII, gösterim `homeNames`/`awayNames`

Uygulamadaki `norm()` fonksiyonu favori eşleşmesini `home`/`away` üzerinden yapar ve
yayındaki 1.4.3 sürümünde **aksanlı harfleri siliyor** (`[^a-z0-9]`):

| Yazarsan | `norm()` üretir | Takım kimliği | Sonuç |
|---|---|---|---|
| `Fenerbahçe` | `fenerbahe` | `fenerbahce` | ❌ favorilerde çıkmaz |
| `Fenerbahce` | `fenerbahce` | `fenerbahce` | ✅ |

**Kural:** `home` ve `away` alanlarına **aksansız ASCII** yaz (Fenerbahce, Besiktas,
Atletico-MG, Sao Paulo, Gornik Zabrze). Görünen adı `homeNames`/`awayNames` içine
sekiz dilde koy — uygulama gösterimde onu kullanır, eşleşmede tabanı.

Türkçe karşılıklar: `ç→c  ş→s  ğ→g  ı→i  ö→o  ü→u`. Diğerleri: `á→a é→e í→i ó→o ú→u
ñ→n ã→a õ→o â→a ê→e ô→o å→a ø→o ż→z`.

(Koddaki `norm()` 26 Ağu'da düzeltildi ama **henüz yayınlanmadı**; build gelene kadar
bu kural şart, sonrasında da zararsız.)

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
5. On kaynaktan **en az yedisi** başarıyla çekildi mi.

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
