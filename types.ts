export enum GradientType {
  Linear = 'linear',
  Radial = 'radial',
  Angular = 'angular',
  Diamond = 'diamond',
}

export interface ColorStop {
  color: string;
  position: number;
}

export interface Gradient {
  type: GradientType;
  stops: ColorStop[];
  angle?: number;
  center?: { x: number; y: number };
  rawGeometry?: string;
}

export interface Fill {
  type: 'solid' | 'gradient' | 'noise' | 'texture';
  value: string | Gradient;
  opacity?: number;
  blendMode?: string;
  visible: boolean;
  assetUrl?: string; // For textures/noise exported as images
}

export interface Shadow {
  type: 'drop' | 'inner';
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  visible: boolean;
}

export interface Corners {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface FigmaLayer {
  name: string;
  width: number;
  height: number;
  fills: Fill[];
  corners: Corners | number;
  shadows: Shadow[];
  opacity: number;
  blur?: number; // Layer blur (filter: blur)
  backdropBlur?: number; // Background blur (backdrop-filter: blur)
}