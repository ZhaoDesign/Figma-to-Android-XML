
export enum GradientType {
  Linear = 'linear',
  Radial = 'radial',
  Angular = 'angular',
  Diamond = 'diamond',
}

export interface ColorStop {
  color: string;
  position: number;
  opacity?: number;
}

export interface GradientTransform {
  a: number; // m00 (Scale X / Cos)
  b: number; // m10 (Skew Y / Sin)
  c: number; // m01 (Skew X / -Sin)
  d: number; // m11 (Scale Y / Cos)
  tx: number; // m02 (Translate X)
  ty: number; // m12 (Translate Y)
  // Derived helper values for convenience, though raw matrix is source of truth
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Gradient {
  type: GradientType;
  stops: ColorStop[];
  // Legacy/Fallback fields
  angle?: number;
  center?: { x: number; y: number };
  size?: { x: number; y: number };
  handles?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  // The Source of Truth for fidelity
  transform?: GradientTransform;
}

export interface Fill {
  type: 'solid' | 'gradient' | 'noise' | 'texture';
  value: string | Gradient;
  opacity?: number;
  blendMode?: string;
  visible: boolean;
  assetUrl?: string;
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
  blur?: number;
  backdropBlur?: number;
}
