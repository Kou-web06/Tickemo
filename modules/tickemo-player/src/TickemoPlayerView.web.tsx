import * as React from 'react';

import { TickemoPlayerViewProps } from './TickemoPlayer.types';

export default function TickemoPlayerView(props: TickemoPlayerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
