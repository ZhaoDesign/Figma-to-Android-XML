
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

export interface Gradient {
  type: GradientType;
  stops: ColorStop[];
  // 增加坐标支持，用于线性渐变直传
  coords?: {
    x1: number; y1: number;
    x2: number; y2: number;
  };
  transform?: {
    a: number; b: number; c: number; d: number;
    tx: number; ty: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
}

export interface Fill {
  type: 'solid' | 'gradient';
  value: string | Gradient;
  opacity?: number;
  visible: boolean;
  pathData?: string; // 存储原始路径指令
}

export interface FigmaLayer {
  name: string;
  width: number;
  height: number;
  fills: Fill[];
  corners: number;
  shadows: any[];
  opacity: number;
}

// Added PrimitiveLayer interface to resolve import error in services/decomposer.ts
export interface PrimitiveLayer {
  id: string;
  shape: 'ellipse' | 'rect';
  width: number;
  height: number;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
  fill: {
    type: 'solid' | 'gradient';
    color?: string;
    stops?: ColorStop[];
    opacity: number;
    blendMode: string;
    blur: number;
  };
}
