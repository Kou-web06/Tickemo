import { NativeModule, requireNativeModule } from 'expo';

import { TickemoPlayerModuleEvents } from './TickemoPlayer.types';

declare class TickemoPlayerModule extends NativeModule<TickemoPlayerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<TickemoPlayerModule>('TickemoPlayer');
