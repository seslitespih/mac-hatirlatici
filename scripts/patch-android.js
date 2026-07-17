const fs = require('fs');
const path = require('path');

// expo-background-fetch: mTask null iken onHostPause/onHostDestroy'da NPE crash
// (bildirim izni dialogu gibi bir sebeple activity, görev kaydı bitmeden pause
// olursa startAlarm -> createTaskIntent null task ile çağrılıp uygulamayı çökertiyor)
const p1 = path.join(
  __dirname, '..',
  'node_modules/expo-background-fetch/android/src/main/java/expo/modules/backgroundfetch/BackgroundFetchTaskConsumer.java'
);
if (fs.existsSync(p1)) {
  let c = fs.readFileSync(p1, 'utf8');
  let patched = false;

  if (!c.includes('if (mTask == null || alarmManager == null)')) {
    c = c.replace(
      'if (alarmManager == null) {\n      return;\n    }',
      'if (mTask == null || alarmManager == null) {\n      return;\n    }'
    );
    patched = true;
  }

  if (c.includes('if (alarmManager != null && mPendingIntent != null) {')) {
    c = c.replace(
      'if (alarmManager != null && mPendingIntent != null) {',
      'if (mTask != null && alarmManager != null && mPendingIntent != null) {'
    );
    patched = true;
  }

  // didReceiveBroadcast (BOOT_COMPLETED) içindeki ilk kullanım
  if (!c.includes('if (mTask == null) {\n      return;\n    }\n    Map<String, Object> options')) {
    c = c.replace(
      'Map<String, Object> options = mTask.getOptions();',
      'if (mTask == null) {\n      return;\n    }\n    Map<String, Object> options = mTask.getOptions();'
    );
    patched = true;
  }

  // onHostDestroy içindeki kullanım (yorum satırıyla hedeflenir)
  const destroyOld =
    '    // Otherwise it should continue to work when the activity is terminated.\n' +
    '    Map<String, Object> options = mTask.getOptions();';
  const destroyNew =
    '    // Otherwise it should continue to work when the activity is terminated.\n' +
    '    if (mTask == null) {\n      return;\n    }\n' +
    '    Map<String, Object> options = mTask.getOptions();';
  if (c.includes(destroyOld)) {
    c = c.replace(destroyOld, destroyNew);
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(p1, c);
    console.log('Patched expo-background-fetch (null task guards)');
  }
}
