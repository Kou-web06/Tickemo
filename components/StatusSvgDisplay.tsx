import React, { useMemo } from 'react';
import { SvgUri } from 'react-native-svg';
import { getStatusSvgUris } from '../utils/statusSvgs';

interface StatusSvgDisplayProps {
  fanLevel: 'ROOKIE' | 'EXPERT' | 'MASTER' | 'LEGEND';
  style?: any;
}

const StatusSvgDisplay = React.memo(({ fanLevel, style }: StatusSvgDisplayProps) => {
  const statusSvgUris = useMemo(() => getStatusSvgUris(), []);

  const uri = useMemo(() => {
    switch (fanLevel) {
      case 'LEGEND':
        return statusSvgUris.legend;
      case 'MASTER':
        return statusSvgUris.master;
      case 'EXPERT':
        return statusSvgUris.expert;
      case 'ROOKIE':
      default:
        return statusSvgUris.rookie;
    }
  }, [fanLevel, statusSvgUris]);

  return (
    <SvgUri
      uri={uri}
      width={110}
      height={110}
      style={style}
    />
  );
});

StatusSvgDisplay.displayName = 'StatusSvgDisplay';

export default StatusSvgDisplay;
