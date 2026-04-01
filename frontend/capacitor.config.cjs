/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.inspectai.app',
  appName: 'InspectAI',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

module.exports = config;
