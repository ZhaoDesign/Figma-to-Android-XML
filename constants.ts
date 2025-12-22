import { FigmaLayer, GradientType } from './types';

export const INITIAL_DATA: FigmaLayer = {
  name: "Sample Button",
  width: 320,
  height: 64,
  opacity: 1,
  corners: 16,
  fills: [
    {
      type: 'gradient',
      visible: true,
      value: {
        type: GradientType.Linear,
        angle: 90, // Left to right
        stops: [
          { color: 'rgba(99, 102, 241, 1)', position: 0 },
          { color: 'rgba(168, 85, 247, 1)', position: 100 }
        ]
      }
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
