// Reexport the native module. On web, it will be resolved to TickemoPlayerModule.web.ts
// and on native platforms to TickemoPlayerModule.ts
export { default } from './src/TickemoPlayerModule';
export { default as TickemoPlayerView } from './src/TickemoPlayerView';
export * from  './src/TickemoPlayer.types';
