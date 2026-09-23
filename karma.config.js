module.exports = function (config) {
  config.set({
    frameworks: ['browserify', 'mocha', 'chai', 'sinon'],
    files: [
      'test/**/*.test.js',
      {
        pattern: 'wasm/bin/dcmtk-wasm.wasm',
        included: false,
        watched: false,
        served: true,
      },
    ],
    preprocessors: {
      'test/**/*.test.js': 'browserify',
    },
    reporters: ['mocha'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
    browsers: [process.env.CI ? 'ChromeHeadlessNoSandbox' : 'ChromeHeadless'],
    autoWatch: false,
    singleRun: true,
    concurrency: Infinity,
  });
};
