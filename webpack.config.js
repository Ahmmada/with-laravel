// webpack.config.js
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // إضافة قاعدة لملفات .wasm
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'webassembly/async', // أو 'webassembly/sync'
  });

  // لإصدارات Webpack الأقدم، قد تحتاج إلى هذا
  // config.experiments = {
  //   asyncWebAssembly: true,
  //   syncWebAssembly: true,
  // };

  return config;
};
