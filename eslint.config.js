// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // A web-only concern: React Native <Text> renders quotes and apostrophes literally.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: ['dist/*', '.expo/*', '.claude/*', 'ios/*', 'android/*', 'coverage/*'],
  },
]);
