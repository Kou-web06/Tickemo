import { ImageSourcePropType } from 'react-native';

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
