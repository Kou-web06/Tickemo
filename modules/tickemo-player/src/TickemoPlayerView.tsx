import { requireNativeView } from 'expo';
import * as React from 'react';

import { TickemoPlayerViewProps } from './TickemoPlayer.types';

const NativeView: React.ComponentType<TickemoPlayerViewProps> =
  requireNativeView('TickemoPlayer');

export default function TickemoPlayerView(props: TickemoPlayerViewProps) {
  return <NativeView {...props} />;
}
