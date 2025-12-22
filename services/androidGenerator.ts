import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

// Android Hex is #AARRGGBB
const toAndroidHex = (cssColor: string, forceRgbFrom?: string): string => {
  // 1. Helper to get RGBA from string
  const getRgba = (c: string) => {
    // Create a dummy element/canvas to normalize color string (handles named colors, rgb, hsl, hex)
    if (c.startsWith('#') && c.length === 9) {
        // Already #AARRGGBB (our internal format mostly) or #RRGGBBAA? 
        // CSS usually uses #RRGGBBAA.
        const r = parseInt(c.slice(1,3), 16);
        const g = parseInt(c.slice(3,5), 16);
        const b = parseInt(c.slice(5,7), 16);
        const a = parseInt(c.slice(7,9), 16) / 255;
        return {r,g,b,a};
    }
    
    // Fallback parsing
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return {r:0,g:0,b:0,a:1};
    ctx.fillStyle = c;
    let computed = ctx.fillStyle; // returns #RRGGBB or rgba()
    
    if (computed.startsWith('#')) {
       const r = parseInt(computed.slice(1,3), 16);
       const g = parseInt(computed.slice(3,5), 16);
       const b = parseInt(computed.slice(5,7), 16);
       return {r,g,b,a:1};
    }
    if (computed.startsWith('rgba')) {
        const parts = computed.match(/[\d.]+/g);
        if (parts && parts.length >= 4) {
            return {r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]), a: parseFloat(parts[3])};
        }
    }
    return {r:0, g:0, b:0, a:1};
  };

  const current = getRgba(cssColor);
  
  // 2. "Muddy Gray" Fix:
  // If this color is fully transparent (alpha=0), Android interpolates it as Black Transparent (#00000000).
  // If blending with Red, it goes Red -> Dark Red -> Gray -> Transparent.
  // We want Red -> Transparent Red.
  // So if alpha is 0, we use the RGB from 'forceRgbFrom' if provided.
  if (current.a <= 0.01 && forceRgbFrom) {
      const neighbor = getRgba(forceRgbFrom);
      // Return neighbor's RGB with 00 Alpha
      const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
      return `#00${toHex(neighbor.r)}${toHex(neighbor.g)}${toHex(neighbor.b)}`;
  }

  // Standard Return #AARRGGBB
  const alphaInt = Math.round(current.a * 255);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(alphaInt)}${toHex(current.r)}${toHex(current.g)}${toHex(current.b)}`;
};

const parseColorToRgba = (color: string): {r: number, g: number, b: number, a: number} => {
    // simplified for interpolation usage
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return {r:0,g:0,b:0,a:1};
    ctx.fillStyle = color;
    const computed = ctx.fillStyle;
    
    if (computed.startsWith('#')) {
        const r = parseInt(computed.slice(1,3), 16);
        const g = parseInt(computed.slice(3,5), 16);
        const b = parseInt(computed.slice(5,7), 16);
        return {r,g,b,a:1};
    }
    const match = computed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
    if(match) {
        return {
            r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]),
            a: match[4] ? parseFloat(match[4]) : 1
        };
    }
    return {r:0,g:0,b:0,a:1};
};

const interpolateColor = (c1: string, c2: string, factor: number): string => {
    const start = parseColorToRgba(c1);
    const end = parseColorToRgba(c2);
    const t = Math.max(0, Math.min(1, factor));
    const r = start.r + (end.r - start.r) * t;
    const g = start.g + (end.g - start.g) * t;
    const b = start.b + (end.b - start.b) * t;
    const a = start.a + (end.a - start.a) * t;
    const alphaInt = Math.round(a * 255);
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(alphaInt)}${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getColorAtPosition = (stops: ColorStop[], targetPos: number): string => {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    if (targetPos <= sorted[0].position) return sorted[0].color;
    if (targetPos >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (targetPos >= current.position && targetPos <= next.position) {
            const range = next.position - current.position;
            if (range === 0) return current.color;
            const progress = (targetPos - current.position) / range;
            return interpolateColor(current.color, next.color, progress);
        }
    }
    return sorted[0].color;
};

const mapAngle = (cssDeg: number): number => {
  let android = (450 - cssDeg) % 360;
  // Snap to nearest 45
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
  const { angle = 180, stops, type, rawGeometry } = gradient;
  
  // --- Smart Transparency Fix ---
  // If the start or end colors are transparent, we need to "borrow" the RGB from the center/adjacent colors
  // so Android interpolates opacity only, not color.
  
  const rawStart = getColorAtPosition(stops, 0);
  const rawEnd = getColorAtPosition(stops, 100);
  const rawCenter = getColorAtPosition(stops, 50); // Sample middle for reference

  // If Start is transparent, borrow RGB from Center (or End)
  const startColor = toAndroidHex(rawStart, rawCenter);
  // If End is transparent, borrow RGB from Center (or Start)
  const endColor = toAndroidHex(rawEnd, rawCenter);
  
  // For Center, just use as is
  const centerHex = toAndroidHex(rawCenter);

  let centerAttr = '';
  if (stops.length > 2) {
    centerAttr = `\n        android:centerColor="${centerHex}"`;
  }

  let typeAttr = '';
  let angleAttr = '';
  
  if (type === GradientType.Radial) {
    typeAttr = 'android:type="radial"';
    
    // Heuristic for Gradient Radius based on CSS geometry
    let radiusVal = "75%p"; // Default
    
    if (rawGeometry) {
        // Match percentage or pixel values.
        // Support "100% 50%" (ellipse) or "150px" or "100%"
        const matches = rawGeometry.match(/(\d+(?:\.\d+)?)(%|px)/g);
        
        if (matches && matches.length > 0) {
            // Take the largest dimension found to ensure coverage
            let maxVal = 0;
            let unit = '%';
            
            matches.forEach(m => {
                const val = parseFloat(m); // extracts number
                if (m.includes('%')) {
                   if (val > maxVal) { maxVal = val; unit = '%p'; } // Android uses %p for parent relative
                } else if (m.includes('px')) {
                   // px is harder to map to %p without context, but let's assume if it's huge, we use it as dp?
                   // No, Android gradientRadius can be dimension (dp) or %p.
                   if (val > maxVal) { maxVal = val; unit = 'dp'; } 
                }
            });
            
            // Limit insane values
            if (unit === '%p') {
                radiusVal = `${Math.min(maxVal, 200)}%p`;
            } else {
                radiusVal = `${Math.round(maxVal)}dp`;
            }
        }
    }
    
    angleAttr = `android:gradientRadius="${radiusVal}"`; 
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
    
    // Shadows
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

    // Fills
    // Android draws top-down (last item is on top).
    // layer.fills[0] is Figma Top.
    // So we reverse it: [Bottom, ..., Top].
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
    
    // Inner Shadows
    if (innerShadows.length > 0) {
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
