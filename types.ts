export enum GradientType {
  Linear = 'linear',
  Radial = 'radial',
  Angular = 'angular', // Not fully supported in Android XML without hacks
}

export interface ColorStop {
  color: string; // rgba or hex
  position: number; // 0 to 100
}

export interface Gradient {
  type: GradientType;
  stops: ColorStop[];
  angle?: number; // For linear: degrees (0-360)
  center?: { x: number; y: number }; // For radial
}

export interface Fill {
  type: 'solid' | 'gradient';
  value: string | Gradient; // Hex string for solid, Gradient obj for gradient
  opacity?: number;
  blendMode?: string;
  visible: boolean;
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

// The Intermediate Representation (IR) of the Figma Layer
export interface FigmaLayer {
  name: string;
  width: number;
  height: number;
  fills: Fill[];
  corners: Corners | number; // Number if uniform
  shadows: Shadow[];
  opacity: number;
}
