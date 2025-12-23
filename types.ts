
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
  a: number; b: number; c: number; d: number; tx: number; ty: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// --- The New Layer Graph Architecture ---

export type PrimitiveShape = 'ellipse' | 'rect';

export interface PrimitiveLayer {
  id: string;
  shape: PrimitiveShape;
  // Standardized Geometry (0..1 space or pixel space, we use pixel space for easier Android mapping)
  width: number;
  height: number;
  transform: {
    x: number;
    y: number;
    rotation: number; // Degrees
    scaleX: number;
    scaleY: number;
  };
  // Visuals
  fill: {
    type: 'solid' | 'gradient'; // Even primitives might need a simple fade
    color: string; // Main color
    stops?: ColorStop[]; // If it's a gradient primitive
    opacity: number;
    blendMode: string;
    blur: number; // The visual "spread" of this layer
  };
}

// Legacy interfaces kept for Parsing input, but Output is now PrimitiveLayer[]
export interface Gradient {
  type: GradientType;
  stops: ColorStop[];
  transform?: GradientTransform;
  // Legacy fields
  angle?: number; center?: {x:number, y:number}; size?: {x:number, y:number};
}

export interface Fill {
  type: 'solid' | 'gradient' | 'noise' | 'texture';
  value: string | Gradient;
  opacity?: number;
  blendMode?: string;
  visible: boolean;
}

export interface Shadow {
  type: 'drop' | 'inner';
  x: number; y: number; blur: number; spread: number; color: string; visible: boolean;
}

export interface Corners {
  topLeft: number; topRight: number; bottomRight: number; bottomLeft: number;
}

export interface FigmaLayer {
  name: string;
  width: number;
  height: number;
  fills: Fill[];
  corners: Corners | number;
  shadows: Shadow[];
  opacity: number;
}
