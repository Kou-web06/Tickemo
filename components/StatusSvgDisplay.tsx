import React from 'react';
import { View } from 'react-native';

interface StatusSvgDisplayProps {
  fanLevel: 'ROOKIE' | 'EXPERT' | 'MASTER' | 'LEGEND';
  style?: any;
}

const StatusSvgDisplay = React.memo(({ style }: StatusSvgDisplayProps) => {
  return <View style={style} />;
});

StatusSvgDisplay.displayName = 'StatusSvgDisplay';

export default StatusSvgDisplay;
