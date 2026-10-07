const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// functions/ is the Firebase Cloud Functions project (server code, own node_modules); never bundle it.
const functionsDir = path.resolve(__dirname, 'functions').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), new RegExp(`^${functionsDir}[/\\\\]`)];

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
