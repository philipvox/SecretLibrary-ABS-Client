/**
 * babel.config.js
 *
 * Babel configuration with production optimizations.
 */

module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],

    plugins: [
      // Path aliasing (@/ -> ./src, @modules/ -> ./modules, @assets/ -> ./assets)
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@modules': './modules',
            '@assets': './assets',
          },
        },
      ],

      // React Native Reanimated (must be last)
      'react-native-reanimated/plugin',
    ],

    env: {
      // ============================================
      // PRODUCTION OPTIMIZATIONS
      // ============================================
      production: {
        plugins: [
          // Remove console.* statements in production
          'transform-remove-console',

          // Inline environment variables
          [
            'transform-inline-environment-variables',
            {
              include: ['NODE_ENV'],
            },
          ],
        ],
      },

      // ============================================
      // DEVELOPMENT SETTINGS
      // ============================================
      development: {
        plugins: [
          // Keep console in development
        ],
      },
    },

    // Source maps for debugging
    sourceMaps: !isProduction,
    retainLines: !isProduction,
  };
};
