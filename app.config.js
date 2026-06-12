// app.config.js — Dinamik Expo konfigürasyonu
// .env dosyasındaki değerleri okur, hassas bilgileri kaynak koddan ayırır

const IS_PROD = process.env.APP_ENV === 'production';

module.exports = {
  expo: {
    name: 'Hangi Kanalda?',
    slug: 'hangi-kanalda',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'mac-hatirlatici',

    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0f0f1a',
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f0f1a',
      },
      package: 'com.machatirlatici.app',
      versionCode: 1,
      permissions: [
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.SCHEDULE_EXACT_ALARM',
      ],
      // google-services.json sadece Firebase/FCM kullanıyorsak gerekli
      // Lokal bildirimler için gerekli değil — yorum satırı bırakıldı
      // googleServicesFile: './google-services.json',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.machatirlatici.app',
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
            usesCleartextTraffic: false,         // HTTPS zorunlu (güvenlik)
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 26,                   // Android 8.0+
          },
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
    },

    // extra: uygulama içinde Constants.expoConfig.extra üzerinden erişilir
    extra: {
      footballDataToken: process.env.FOOTBALL_DATA_TOKEN ?? '',
      rapidApiKey:       process.env.RAPID_API_KEY ?? '',
      groqApiKey:        process.env.GROQ_API_KEY ?? '',
      rcApiKeyIos:       process.env.REVENUECAT_IOS_KEY ?? '',
      rcApiKeyAndroid:   process.env.REVENUECAT_ANDROID_KEY ?? '',
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? '',
      },
    },
  },
};
