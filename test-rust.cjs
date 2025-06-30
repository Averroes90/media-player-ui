// test-rust.js
try {
  let nativeModule;
  try {
    nativeModule = require('./native/native.darwin-arm64.node');
  } catch {
    nativeModule = require('./native/native.node');
  }

  console.log('✅ Rust module loaded successfully!');
  console.log('Test message:', nativeModule.helloFromRust());
  console.log('System info:', nativeModule.getSystemInfo());
} catch (error) {
  console.error('❌ Failed to load Rust module:', error);
}
