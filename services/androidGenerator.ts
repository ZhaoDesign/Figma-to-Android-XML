import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

// Android Hex is #AARRGGBB
const toAndroidHex = (cssColor: string): string => {
  // Fast path for Hex
  if (cssColor.startsWith('#')) {
    if (cssColor.length === 7) return '#FF' + cssColor.substring(1).toUpperCase();
    if (cssColor.length === 9) return cssColor.toUpperCase(); 
    if (cssColor.length === 4) {
      const r = cssColor[1]; const g = cssColor[2]; const b = cssColor[3];
      return `#FF${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return '#FF' + cssColor.substring(1).toUpperCase();
  }

  const match = cssColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const aVal = match[4] !== undefined ? parseFloat(match[4]) : 1;
    const alphaInt = Math.round(aVal * 255);
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(alphaInt)}${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  // Fallback using Canvas
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#FF000000';
  ctx.fillStyle = cssColor;
  const computed = ctx.fillStyle; 
  if (computed.startsWith('#')) {
     if (computed.length === 7) return '#FF' + computed.substring(1).toUpperCase();
     return computed.toUpperCase();
  }
  return '#FF000000';
};

// Helper: Parse Hex/RGBA to {r,g,b,a} for math
const parseColorToRgba = (color: string): {r: number, g: number, b: number, a: number} => {
    // We leverage the browser's ability to normalize colors via our toAndroidHex, then parse that back
    const hex = toAndroidHex(color); // #AARRGGBB
    const a = parseInt(hex.substring(1, 3), 16) / 255;
    const r = parseInt(hex.substring(3, 5), 16);
    const g = parseInt(hex.substring(5, 7), 16);
    const b = parseInt(hex.substring(7, 9), 16);
    return { r, g, b, a };
};

// Interpolate between two colors
const interpolateColor = (c1: string, c2: string, factor: number): string => {
    const start = parseColorToRgba(c1);
    const end = parseColorToRgba(c2);
    
    // Clamp factor 0-1
    const t = Math.max(0, Math.min(1, factor));
    
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    const a = start.a + (end.a - start.a) * t;
    
    const alphaInt = Math.round(a * 255);
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    
    return `#${toHex(alphaInt)}${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Calculate the color at a specific percentage (0-100) based on existing stops
const getColorAtPosition = (stops: ColorStop[], targetPos: number): string => {
    // Sort stops
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    
    // Boundary checks
    if (targetPos <= sorted[0].position) return sorted[0].color;
    if (targetPos >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
    
    // Find surrounding stops
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (targetPos >= current.position && targetPos <= next.position) {
            const range = next.position - current.position;
            const progress = (targetPos - current.position) / range;
            return interpolateColor(current.color, next.color, progress);
        }
    }
    return sorted[0].color; // Fallback
};

const mapAngle = (cssDeg: number): number => {
  let android = (450 - cssDeg) % 360;
  const remainder = android % 45;
  if (remainder < 22.5) {
    android = android - remainder;
  } else {
    android = android + (45 - remainder);
  }
  return android % 360;
};

const generateCorners = (corners: Corners | number): string => {
  if (typeof corners === 'number') {
    if (corners === 0) return '';
    return `    <corners android:radius="${corners}dp" />\n`;
  }
  return `    <corners 
        android:topLeftRadius="${corners.topLeft}dp"
        android:topRightRadius="${corners.topRight}dp"
        android:bottomLeftRadius="${corners.bottomLeft}dp"
        android:bottomRightRadius="${corners.bottomRight}dp" />\n`;
};

const generateGradient = (gradient: Gradient): string => {
  const { angle = 180, stops, type } = gradient;
  
  // Calculate exact colors for Android's start(0%), center(50%), end(100%)
  // ignoring where the actual stops are (e.g. -20% or 150%)
  const startColor = toAndroidHex(getColorAtPosition(stops, 0));
  const endColor = toAndroidHex(getColorAtPosition(stops, 100));
  
  let centerAttr = '';
  // Check if we have a significant color shift in the middle
  // We determine "center" by strictly sampling at 50%
  const centerHex = toAndroidHex(getColorAtPosition(stops, 50));
  
  // Optimization: Only add center color if it's not just a linear mix of start/end.
  // But for fidelity, usually safer to add it if the stops suggest complexity.
  // Simple check: if we have > 2 stops originally, we add center.
  if (stops.length > 2) {
    centerAttr = `\n        android:centerColor="${centerHex}"`;
  }

  let typeAttr = '';
  let angleAttr = '';
  
  if (type === GradientType.Radial) {
    typeAttr = 'android:type="radial"';
    // For Radial gradients in Figma (especially soft highlights), the visual "end" 
    // often corresponds to the width of the element or more.
    // 50%p is strict radius (half width). 75%p often feels closer to CSS 'farthest-corner' for button glows.
    // If the user drags handles outside, our `endColor` interpolation handles the fade, 
    // but we need enough geometric room.
    angleAttr = 'android:gradientRadius="75%p"'; 
  } else {
    const androidAngle = mapAngle(angle);
    angleAttr = `android:angle="${androidAngle}"`;
  }

  return `    <gradient 
        ${typeAttr}
        ${angleAttr}
        android:startColor="${startColor}"${centerAttr}
        android:endColor="${endColor}" />\n`;
};

export const generateAndroidXML = (layer: FigmaLayer): string => {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from Figma -->\n`;
  
  const needsLayerList = layer.fills.length > 1 || layer.shadows.length > 0;
  
  if (needsLayerList) {
    xml += `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n`;
    
    // 1. Drop Shadows
    const dropShadows = layer.shadows.filter(s => s.type === 'drop' && s.visible);
    const innerShadows = layer.shadows.filter(s => s.type === 'inner' && s.visible);
    
    if (dropShadows.length > 0) {
        xml += `    <!-- ⚠️ Note: Drop Shadows in XML are approximations. Prefer android:elevation on the View. -->\n`;
        dropShadows.forEach((shadow) => {
             xml += `    <item android:left="${shadow.x}dp" android:top="${shadow.y}dp">\n`;
             xml += `        <shape android:shape="rectangle">\n`;
             xml += `            <solid android:color="${toAndroidHex(shadow.color)}" />\n`;
             xml += `            <corners android:radius="${typeof layer.corners === 'number' ? layer.corners : layer.corners.topLeft}dp" />\n`;
             xml += `        </shape>\n`;
             xml += `    </item>\n`;
        });
    }

    // 2. Fills
    const reversedFills = [...layer.fills].reverse();
    
    reversedFills.forEach((fill) => {
        if (!fill.visible) return;
        xml += `    <item>\n`;
        xml += `        <shape android:shape="rectangle">\n`;
        
        if (fill.type === 'solid') {
            xml += `            <solid android:color="${toAndroidHex(fill.value as string)}" />\n`;
        } else {
            xml += generateGradient(fill.value as Gradient);
        }
        xml += generateCorners(layer.corners);
        xml += `        </shape>\n`;
        xml += `    </item>\n`;
    });
    
    // 3. Inner Shadows
    if (innerShadows.length > 0) {
        xml += `    <!-- ⚠️ Inner Shadow approximation -->\n`;
        innerShadows.forEach(shadow => {
            xml += `    <item>\n`;
             xml += `        <shape android:shape="rectangle">\n`;
             xml += `             <stroke android:width="1dp" android:color="${toAndroidHex(shadow.color)}" />\n`;
             xml += generateCorners(layer.corners);
             xml += `        </shape>\n`;
             xml += `    </item>\n`;
        });
    }
    xml += `</layer-list>`;
    
  } else {
    // Simple Shape
    xml += `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n`;
    const fill = layer.fills[0];
    if (fill) {
         if (fill.type === 'solid') {
            xml += `    <solid android:color="${toAndroidHex(fill.value as string)}" />\n`;
        } else {
            xml += generateGradient(fill.value as Gradient);
        }
    }
    xml += generateCorners(layer.corners);
    xml += `</shape>`;
  }
  
  return xml;
};
