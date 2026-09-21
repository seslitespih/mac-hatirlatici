// app.config.js — Dinamik Expo konfigürasyonu
// .env dosyasındaki değerleri okur, hassas bilgileri kaynak koddan ayırır

const IS_PROD = process.env.APP_ENV === 'production';

// google-services.json .gitignore'da (herkese acik depo). CI'da GOOGLE_SERVICES_JSON secret'indan
// yazilir. Dosya yoksa FCM satiri devre disi kalir: derleme KIRILMAZ, uygulama eskisi gibi
// yerel bildirimle calisir (pushService token alamaz -> false doner).
/** RevenueCat anahtari dogru magazaya mi ait? Degilse bilinen gecerli anahtara don. */
const rcAnahtar = (deger, onEk, yedek) =>
  (typeof deger === 'string' && deger.startsWith(onEk)) ? deger : yedek;

const GOOGLE_SERVICES = require('fs').existsSync(__dirname + '/google-services.json')
  ? './google-services.json'
  : undefined;

module.exports = {
  expo: {
    name: 'Sports on TV',
    slug: 'hangi-kanalda',

    // Ana ekrandaki simge adi dile gore degisir (prebuild bunlardan
    // ios/Runner/<lang>.lproj/InfoPlist.strings uretir).
    // Android tarafi: android/app/src/main/res/values-<lang>/strings.xml
    locales: {
      en: './locales/en.json',
      tr: './locales/tr.json',
      es: './locales/es.json',
      de: './locales/de.json',
      fr: './locales/fr.json',
      it: './locales/it.json',
      pt: './locales/pt.json',
      ar: './locales/ar.json',
    },
    version: '1.4.4',
    // Android 16 buyuk ekranlarda yon kisitlamasini YOK SAYIYOR; Play de kaldirilmasini
    // istiyor. 'default' = cihazin yonunu izle. Ekranlar liste tabanli ve SafeAreaView
    // kullaniyor; yatay gorunum derlemeden sonra emulatorde kontrol edilmeli.
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F0F5FF',
    scheme: 'mac-hatirlatici',

    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#F0F5FF',
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A1831',
      },
      package: 'com.machatirlatici.app',
      versionCode: parseInt(process.env.VERSION_CODE ?? '58'),
      permissions: [
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.SCHEDULE_EXACT_ALARM',
      ],
      // 1.4.4: push bildirimleri icin FCM gerekli (Android'de uzaktan bildirimin tek kanali).
      // Uygulamaya Firebase KUTUPHANESI eklenmedi; expo-notifications zaten iceriyor, bu dosya
      // yalniz hangi projeye baglanacagini soyler. Firebase projesi: mac-hatirlatici-bildirim.
      googleServicesFile: GOOGLE_SERVICES,
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.machatirlatici.app',
      buildNumber: process.env.BUILD_NUMBER ?? '73',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#e94560',
          // Android 13+ için POST_NOTIFICATIONS izni otomatik eklenir
          sounds: [],
        },
      ],
      // Lokal bildirimler için arka plan çalışma izni
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: false,
            // Play zorunlulugu (21 Eyl 2026): hedef API 36. AGP 8.6 (Expo 52) API 36'yi
            // resmen bilmiyor; android.yml prebuild sonrasi suppressUnsupportedCompileSdk ekliyor.
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            // Play "DEX kodu optimizasyonu esigin altinda" dedi (karartma %3, son tarih Sub 2027).
            // R8 hem kucultur hem karartir. Expo/RN kurallari node_modules'den otomatik gelir.
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            // R8, yalniz reflection ile cagrilan siniflari "kullanilmiyor" sanip atiyor.
            // 21 Eyl 2026: RNHeadlessAppLoader dex'ten dustu -> arka plan gorevi (gunluk
            // fikstur cekme) calismaz hale gelirdi. Dogrulama: dex icinde sinif adini ara.
            extraProguardRules: [
              '-keep class expo.modules.** { *; }',
              '-keep class expo.core.** { *; }',
              '-keep class com.facebook.react.HeadlessJsTaskService { *; }',
              '-keep class * implements expo.modules.core.interfaces.Package { *; }',
              '-keepnames class * implements expo.modules.kotlin.modules.Module',
            ].join(String.fromCharCode(10)),
            minSdkVersion: 26,
            ndkVersion: '28.2.13676358',
          },
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      './plugins/withPodfilePatches',
      './plugins/withAndroid16',
    ],

    experiments: {
      typedRoutes: true,
    },

    // extra: uygulama içinde Constants.expoConfig.extra üzerinden erişilir
    extra: {
      footballDataToken: process.env.FOOTBALL_DATA_TOKEN ?? '',
      rapidApiKey:       process.env.RAPID_API_KEY ?? '',
      groqApiKey:        process.env.GROQ_API_KEY ?? '',
      // ⚠️ 21 Eyl 2026: CI'daki REVENUECAT_ANDROID_KEY gizli degeri bir TEST magaza
      // anahtari ('test_...'). RevenueCat SDK 10 surum derlemesinde bunu reddediyor:
      // "Test Store API key used in release build" -> teklifler yuklenemiyor, Android'de
      // abonelik satin alinamiyor. Yanlis on ekli anahtar artik yok sayilir.
      rcApiKeyIos:       rcAnahtar(process.env.REVENUECAT_IOS_KEY, 'appl_', 'appl_DBXnXzCViacQTaNmOobAfGHuYGf'),
      rcApiKeyAndroid:   rcAnahtar(process.env.REVENUECAT_ANDROID_KEY, 'goog_', 'goog_kKIpmpVTfhMJaJjQjzOIcFrZsGR'),
      eas: {
        projectId: '1df49d90-6cfa-49a4-9815-bbab3db6e612',
      },
    },
  },
};
