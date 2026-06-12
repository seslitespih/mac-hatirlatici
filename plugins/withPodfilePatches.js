const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withPodfilePatches(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;

      let content = fs.readFileSync(podfilePath, 'utf8');

      // :privacy_file_aggregation_enabled satirini kaldir
      content = content.replace(/^.*:privacy_file_aggregation_enabled.*\n?/gm, '');

      fs.writeFileSync(podfilePath, content);
      return cfg;
    },
  ]);
};
