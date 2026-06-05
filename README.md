# ⚽ Maç Hatırlatıcı — Football Match Reminder

Google Play'e hazır, profesyonel bir futbol maç hatırlatma uygulaması.  
Favori takımlarının maçından **15 dakika önce** kanal bilgisiyle bildirim gönderir.

---

## Özellikler

- 15 dakika önce maç bildirimi (kanal bilgisiyle)
- 80+ takım — Süper Lig, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Şampiyonlar Ligi, Milli Takımlar
- 8 dil desteği: Türkçe, İngilizce, İspanyolca, Portekizce, Fransızca, Almanca, Arapça, İtalyanca
- Günlük/haftalık maç programı (saat + kanal)
- Canlı maç göstergesi
- Karanlık tema
- Gerçek API entegrasyonu (football-data.org + API-Football)

---

## Hızlı Başlangıç

### 1. Bağımlılıkları Kur

```bash
cd "c:\Users\ESAT\Desktop\maç hatırlatıcı"
npm install
```

### 2. Assets Oluştur

```bash
node scripts/generate-assets.js
```

### 3. Geliştirme Sunucusunu Başlat

```bash
npm start
# veya Android için:
npm run android
```

Expo Go uygulamasını telefonuna yükle ve QR kodu tara.

---

## Gerçek API Kurulumu (Opsiyonel)

Mock veriler varsayılan olarak çalışır. Gerçek maç verisi için:

### football-data.org (Ücretsiz — Premier League, Şampiyonlar Ligi, La Liga, Bundesliga, Serie A)

1. [football-data.org](https://www.football-data.org/client/register) adresinden ücretsiz hesap aç
2. API tokenını kopyala
3. `services/apiService.ts` dosyasını aç, şu satırı düzenle:
   ```ts
   const FOOTBALL_DATA_TOKEN = 'BURAYA_TOKEN_YAZ';
   ```

### API-Football / RapidAPI (Ücretsiz 100 istek/gün — Süper Lig dahil TÜM ligler)

1. [rapidapi.com](https://rapidapi.com/api-sports/api/api-football) adresinden ücretsiz key al
2. `services/apiService.ts` dosyasını aç, şu satırı düzenle:
   ```ts
   const RAPID_API_KEY = 'BURAYA_KEY_YAZ';
   ```

> **Not:** API anahtarları olmadan uygulama mock verilerle çalışmaya devam eder.

---

## Google Play Build

### EAS Build Kurulumu

```bash
# EAS CLI kur
npm install -g eas-cli

# Expo hesabına giriş
eas login

# Projeyi yapılandır (ilk seferinde)
eas build:configure
```

### Android APK/AAB Üret

```bash
# Test için APK (sideload)
eas build --platform android --profile preview

# Google Play için AAB
eas build --platform android --profile production
```

### Google Play Console'a Yükle

1. [play.google.com/console](https://play.google.com/console) adresine git
2. Yeni uygulama oluştur
3. AAB dosyasını "Production" → "Releases" bölümünden yükle
4. `store-listing/` klasöründeki metinleri her dil için kopyala
5. En az 3 screenshot, 1 feature graphic ekle
6. İncelemeye gönder

---

## Proje Yapısı

```
maç-hatırlatıcı/
├── app/
│   ├── _layout.tsx          # Root layout (i18n, notifications, splash)
│   └── (tabs)/
│       ├── index.tsx        # Maçlar ekranı
│       ├── teams.tsx        # Takım seçimi
│       └── settings.tsx     # Ayarlar
├── components/
│   ├── MatchCard.tsx        # Maç kartı bileşeni
│   ├── TeamCard.tsx         # Takım kartı bileşeni
│   ├── LeagueHeader.tsx     # Açılır/kapanır lig grubu
│   └── EmptyState.tsx       # Boş durum ekranı
├── constants/
│   ├── teams.ts             # 80+ takım verisi
│   ├── matches.ts           # Mock maç verisi (7 gün)
│   └── channels.ts          # TV kanalları
├── services/
│   ├── apiService.ts        # football-data.org + API-Football
│   ├── matchService.ts      # Hybrid data layer (API + mock)
│   ├── notificationService.ts  # expo-notifications
│   └── storageService.ts    # AsyncStorage
├── hooks/
│   ├── useMatches.ts        # Maç verisi + filtre
│   ├── useTeams.ts          # Takım seçimi
│   └── useNotifications.ts  # Bildirim yönetimi
├── i18n/
│   ├── index.ts             # i18n konfigürasyonu
│   └── locales/             # tr, en, es, pt, fr, de, ar, it
├── store-listing/           # Google Play ASO içerikleri (9 dil)
├── scripts/
│   └── generate-assets.js  # PNG asset üretici
├── assets/                  # icon.png, splash.png vb.
├── app.json
├── package.json
└── eas.json
```

---

## Bildirim Mantığı

```
Uygulama açılır
  → Seçili takımları yükle (AsyncStorage)
  → Önümüzdeki 7 günün maçlarını çek (API veya mock)
  → Her seçili takım maçı için:
      - matchDate - 15 dakika = triggerDate
      - triggerDate > şimdiki zaman ise → Local notification planla
  → Takım seçimi değişirse → Tüm bildirimleri iptal et → Yeniden planla
```

---

## TV Kanalları (Türkiye)

| Kanal | Kanallar |
|-------|----------|
| beIN Sports 1-4 | Süper Lig, Premier League |
| beIN Sports MAX | Şampiyonlar Ligi büyük maçlar |
| S Sport / S Sport 2 | La Liga, Bundesliga |
| TRT Spor / TRT Spor 2 | Milli takım maçları |
| TV8 | Seçili Süper Lig maçları |

---

## Lisans

MIT License — Ticari kullanım serbesttir.
