const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Avoid parsing TypeScript sources from reanimated; use the compiled output instead
const reanimatedCompiledPath = path.resolve(__dirname, 'node_modules/react-native-reanimated/lib/module');

config.resolver.alias = {
	...(config.resolver.alias || {}),
	'react-native-reanimated': reanimatedCompiledPath,
};

config.resolver.extraNodeModules = {
	...(config.resolver.extraNodeModules || {}),
	'react-native-reanimated': reanimatedCompiledPath,
};

// Prefer compiled entry points over "react-native" field (which points to TS src)
// But keep react-native first for native components compatibility
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.mainFields = ['react-native', 'browser', 'main'];

// Ensure .cjs is handled (some compiled deps use it)
if (!config.resolver.sourceExts.includes('cjs')) {
	config.resolver.sourceExts.push('cjs');
}

module.exports = config;
