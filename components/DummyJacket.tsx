import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Image02Icon } from '@hugeicons/core-free-icons';

interface DummyJacketProps {
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

export const DummyJacket: React.FC<DummyJacketProps> = ({ style, iconSize = 18 }) => {
  return (
    <View style={[styles.container, style]}>
      <HugeiconsIcon icon={Image02Icon} size={iconSize} color="#B78ECF" strokeWidth={1.9} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3D9FF',
  },
});
