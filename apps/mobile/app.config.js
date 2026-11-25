const { expo } = require('./app.json');

// The LAN preview build talks to the local API over plain HTTP. Keep Android's
// secure-by-default cleartext policy for every other build.
const enableLanCleartext = process.env.NOCTOWL_LAN_CLEARTEXT === '1';

module.exports = {
  expo: {
    ...expo,
    plugins: enableLanCleartext
      ? [
          ...expo.plugins,
          [
            'expo-build-properties',
            {
              android: {
                usesCleartextTraffic: true,
              },
            },
          ],
        ]
      : expo.plugins,
  },
};
