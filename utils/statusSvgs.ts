import { Image, ImageSourcePropType } from 'react-native';

export const getStatusSvgUris = () => ({
  rookie: Image.resolveAssetSource(require('../assets/status/rookie.png')).uri,
  expert: Image.resolveAssetSource(require('../assets/status/expert.png')).uri,
  master: Image.resolveAssetSource(require('../assets/status/master.png')).uri,
  legend: Image.resolveAssetSource(require('../assets/status/legend.png')).uri,
});

export const getShareCardUri = () => {
  return Image.resolveAssetSource(require('../assets/status/shareCard.svg')).uri;
};

export const getShareCardSource = (
  level: 'ROOKIE' | 'EXPERT' | 'MASTER' | 'LEGEND'
): ImageSourcePropType => {
  switch (level) {
    case 'EXPERT':
      return require('../assets/shareCard/expertCard.png');
    case 'MASTER':
      return require('../assets/shareCard/masterCard.png');
    case 'LEGEND':
      return require('../assets/shareCard/legendCard.png');
    case 'ROOKIE':
    default:
      return require('../assets/shareCard/rookieCard.png');
  }
};
