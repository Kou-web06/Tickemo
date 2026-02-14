import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './TickemoPlayer.types';

type TickemoPlayerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class TickemoPlayerModule extends NativeModule<TickemoPlayerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(TickemoPlayerModule, 'TickemoPlayerModule');
