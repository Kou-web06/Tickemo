const rawMode = (process.env.EXPO_PUBLIC_APP_MODE || '').toLowerCase();

export const isTestflightMode = rawMode === 'testflight';
export const isProductionMode = !__DEV__ && rawMode === 'production';

// // デバッグログ
// console.log('[appMode] __DEV__:', __DEV__, 'rawMode:', rawMode, 'isTestflightMode:', isTestflightMode, 'isProductionMode:', isProductionMode);
