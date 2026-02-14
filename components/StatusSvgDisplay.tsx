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

  const width = style?.width ?? 110;
  const height = style?.height ?? 110;

  return (
    <SvgUri
      uri={uri}
      width={width}
      height={height}
      style={style}
    />
  );
});

StatusSvgDisplay.displayName = 'StatusSvgDisplay';

export default StatusSvgDisplay;
