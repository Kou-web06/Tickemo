module.exports = function withAppleMusic(config) {
  // iOS設定
  if (!config.ios) {
    config.ios = {};
  }
  
  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }
  
  config.ios.infoPlist.NSAppleMusicUsageDescription = 
    'アーティストの楽曲を再生するために、Apple Musicへのアクセスが必要です。';
  
  if (!config.ios.frameworks) {
    config.ios.frameworks = [];
  }
  
  if (!config.ios.frameworks.includes('MusicKit')) {
    config.ios.frameworks.push('MusicKit');
  }
  
  return config;
};

