// Android 15/16 uyumu — Play Console 21 Eyl 2026 uyarisi:
// "Uygulamaniz, uctan uca ekran icin destegi sonlandirilmis API'ler veya parametreler kullaniyor"
//
// Sebep: Expo'nun urettigi styles.xml'e android:statusBarColor yaziliyor. Bu ozellik
// API 35'te kullanimdan kaldirildi; Android 15+ cihazlarda zaten YOK SAYILIYOR, ama
// Play'in statik analizi paketi isaretliyor.
//
// Kaldirmanin gorsel etkisi: Android 14 ve altinda durum cubugu, tema renginden
// (colorPrimary / pencere arkaplani) beslenir. Uygulamanin ekranlari SafeAreaView
// kullandigi icin icerik yine cubuklarin altina girmez.
//
// NOT: react-native cekirdeginin kendi Window.setStatusBarColor cagrisi bu eklentiyle
// kalkmaz; o ancak Expo SDK yukseltmesiyle (react-native-edge-to-edge) temizlenir.
const { withAndroidStyles } = require('@expo/config-plugins');

const KALDIRILACAK = ['android:statusBarColor', 'android:navigationBarColor'];

module.exports = function withAndroid16(config) {
  return withAndroidStyles(config, (cfg) => {
    const stiller = cfg.modResults?.resources?.style ?? [];
    for (const stil of stiller) {
      if (!Array.isArray(stil.item)) continue;
      stil.item = stil.item.filter((i) => !KALDIRILACAK.includes(i?.$?.name));
    }
    return cfg;
  });
};
