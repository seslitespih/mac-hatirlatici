// app.config.js — Dinamik Expo konfigürasyonu
// .env dosyasındaki değerleri okur, hassas bilgileri kaynak koddan ayırır

const IS_PROD = process.env.APP_ENV === 'production';

module.exports = {
  expo: {
    name: 'Match Reminder',
    slug: 'hangi-kanalda',
    version: '1.2.1',
    orientation: 'portrait',
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
      versionCode: parseInt(process.env.VERSION_CODE ?? '54'),
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
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 26,
            ndkVersion: '28.2.13676358',
          },
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      './plugins/withPodfilePatches',
    ],

    experiments: {
      typedRoutes: true,
    },

    // extra: uygulama içinde Constants.expoConfig.extra üzerinden erişilir
    extra: {
      footballDataToken: process.env.FOOTBALL_DATA_TOKEN ?? '',
      rapidApiKey:       process.env.RAPID_API_KEY ?? '',
      groqApiKey:        process.env.GROQ_API_KEY ?? '',
      rcApiKeyIos:       process.env.REVENUECAT_IOS_KEY || 'appl_DBXnXzCViacQTaNmOobAfGHuYGf',
      rcApiKeyAndroid:   process.env.REVENUECAT_ANDROID_KEY || 'goog_kKIpmpVTfhMJaJjQjzOIcFrZsGR',
      eas: {
        projectId: '1df49d90-6cfa-49a4-9815-bbab3db6e612',
      },
    },
  },
};
