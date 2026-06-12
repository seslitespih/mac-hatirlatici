const fs = require('fs');
const path = require('path');

// 1) expo-localization: add default case to Calendar.Identifier switch
const p1 = path.join(__dirname, '..', 'node_modules/expo-localization/ios/LocalizationModule.swift');
if (fs.existsSync(p1)) {
  let c = fs.readFileSync(p1, 'utf8');
  if (!c.includes('default:')) {
    c = c.replace(
      /(    switch calendar\.identifier \{[\s\S]*?)(    \})/,
      (_, body, closing) => body + '    default:\n      return ""\n    }'
    );
    fs.writeFileSync(p1, c);
    console.log('Patched expo-localization');
  }
}

// 2) expo-device: replace TARGET_OS_SIMULATOR
const p2 = path.join(__dirname, '..', 'node_modules/expo-device/ios/UIDevice.swift');
if (fs.existsSync(p2)) {
  let c = fs.readFileSync(p2, 'utf8');
  if (c.includes('TARGET_OS_SIMULATOR')) {
    c = c.replace(
      'return TARGET_OS_SIMULATOR != 0',
      '#if targetEnvironment(simulator)\n    return true\n    #else\n    return false\n    #endif'
    );
    fs.writeFileSync(p2, c);
    console.log('Patched expo-device');
  }
}
