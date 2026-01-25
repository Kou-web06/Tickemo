import { Image } from 'react-native';

export const getStatusSvgUris = () => ({
  rookie: Image.resolveAssetSource(require('../assets/status/rookie.svg')).uri,
  expert: Image.resolveAssetSource(require('../assets/status/expert.svg')).uri,
  master: Image.resolveAssetSource(require('../assets/status/master.svg')).uri,
  legend: Image.resolveAssetSource(require('../assets/status/legend.svg')).uri,
});
