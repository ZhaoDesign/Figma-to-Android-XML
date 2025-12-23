
import { FigmaLayer, GradientType } from './types';

export const INITIAL_DATA: FigmaLayer = {
  name: "Sample Button",
  width: 320,
  height: 64,
  opacity: 1,
  corners: 32,
  fills: [
    {
      type: 'gradient',
      visible: true,
      pathData: "M32 0C14.3269 0 0 14.3269 0 32C0 49.6731 14.3269 64 32 64H288C305.673 64 320 49.6731 320 32C320 14.3269 305.673 0 288 0H32Z",
      value: {
        type: GradientType.Linear,
        stops: [
          { color: '#015AFF', position: 0 },
          { color: '#0582FF', position: 100 }
        ],
        coords: {
          x1: 160, y1: 0,
          x2: 160, y2: 64
        }
      } as any
    }
  ],
  shadows: [
    {
      type: 'drop',
      x: 0,
      y: 4,
      blur: 12,
      spread: 0,
      color: 'rgba(0,0,0,0.3)',
      visible: true
    }
  ]
};
