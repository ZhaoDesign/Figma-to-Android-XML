import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

// Android Hex is #AARRGGBB
const toAndroidHex = (cssColor: string, forceRgbFrom?: string): string => {
  const getRgba = (c: string) => {
    if (c.startsWith('#') && c.length === 9) {
        const r = parseInt(c.slice(1,3), 16);
        const g = parseInt(c.slice(3,5), 16);
        const b = parseInt(c.slice(5,7), 16);
        const a = parseInt(c.slice(7,9), 16) / 255;
        return {r,g,b,a};
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return {r:0,g:0,b:0,a:1};
    ctx.fillStyle = c;
    let computed = ctx.fillStyle; 
    
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
  
  // "Muddy Gray" Fix
  const isTransparentBlack = current.a <= 0.01 && (current.r + current.g + current.b) < 10;
  if (isTransparentBlack && forceRgbFrom) {
      const neighbor = getRgba(forceRgbFrom);
      const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
      return `#00${toHex(neighbor.r)}${toHex(neighbor.g)}${toHex(neighbor.b)}`;
  }

  const alphaInt = Math.round(current.a * 255);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(alphaInt)}${toHex(current.r)}${toHex(current.g)}${toHex(current.b)}`;
};

const parseColorToRgba = (color: string) => {
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
        return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: match[4] ? parseFloat(match[4]) : 1 };
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
  const remainder = android % 45;
  if (remainder < 22.5) {
    android = android - remainder;
  } else {
    android = android + (45 - remainder);
  }
  return android % 360;
};

// --- Shape XML Generation Helper ---

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

const generateShapeGradient = (gradient: Gradient, layerWidth: number, layerHeight: number): string => {
  const { angle = 180, stops, type, rawGeometry } = gradient;
  
  const rawStart = getColorAtPosition(stops, 0);
  const rawEnd = getColorAtPosition(stops, 100);
  const rawCenter = getColorAtPosition(stops, 50);

  const startColor = toAndroidHex(rawStart, rawCenter);
  const endColor = toAndroidHex(rawEnd, rawCenter);
  const centerHex = toAndroidHex(rawCenter);

  let centerAttr = '';
  if (stops.length > 2) {
    centerAttr = `\n        android:centerColor="${centerHex}"`;
  }

  let typeAttr = '';
  let angleAttr = '';
  
  if (type === GradientType.Radial) {
    typeAttr = 'android:type="radial"';
    let radiusVal = "75%p";
    let cxAttr = "";
    let cyAttr = "";

    if (rawGeometry) {
         const atIndex = rawGeometry.indexOf('at ');
         let sizePart = rawGeometry;
         let posPart = "";
         if (atIndex !== -1) {
             sizePart = rawGeometry.substring(0, atIndex).trim();
             posPart = rawGeometry.substring(atIndex + 3).trim();
         }

         if (posPart) {
             const pos = parsePositionKeyword(posPart);
             if (pos) {
                 cxAttr = `android:centerX="${pos.x.toFixed(4)}"`;
                 cyAttr = `android:centerY="${pos.y.toFixed(4)}"`;
             }
         }

         const matches = sizePart.match(/(\d+(?:\.\d+)?)(%|px)/g);
         if (matches && matches.length > 0) {
             let radiiPx: number[] = [];
             matches.forEach((m, index) => {
                const val = parseFloat(m);
                const isWidth = matches.length === 1 || index === 0;
                if (m.includes('%')) {
                    const base = isWidth ? layerWidth : layerHeight;
                    radiiPx.push((val / 100) * base);
                } else {
                    radiiPx.push(val);
                }
             });
             // Geometric mean might be better for "area" coverage, but average is safer for now.
             if (radiiPx.length > 0) {
                 const sum = radiiPx.reduce((a, b) => a + b, 0);
                 const avgPx = sum / radiiPx.length;
                 if (avgPx > 1) {
                    radiusVal = `${Math.round(avgPx)}dp`;
                 }
             }
         }
    }
    
    const cxStr = cxAttr ? `\n        ${cxAttr}` : '';
    const cyStr = cyAttr ? `\n        ${cyAttr}` : '';
    angleAttr = `android:gradientRadius="${radiusVal}"${cxStr}${cyStr}`; 
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

const generateShapeXML = (layer: FigmaLayer): string => {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from Figma -->\n`;
  const needsLayerList = layer.fills.length > 1 || layer.shadows.length > 0;
  
  if (needsLayerList) {
    xml += `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n`;
    
    const dropShadows = layer.shadows.filter(s => s.type === 'drop' && s.visible);
    const innerShadows = layer.shadows.filter(s => s.type === 'inner' && s.visible);
    
    if (dropShadows.length > 0) {
        xml += `    <!-- ⚠️ Note: Drop Shadows in XML are approximations. -->\n`;
        dropShadows.forEach((shadow) => {
             xml += `    <item android:left="${shadow.x}dp" android:top="${shadow.y}dp">\n`;
             xml += `        <shape android:shape="rectangle">\n`;
             xml += `            <solid android:color="${toAndroidHex(shadow.color)}" />\n`;
             xml += `            <corners android:radius="${typeof layer.corners === 'number' ? layer.corners : layer.corners.topLeft}dp" />\n`;
             xml += `        </shape>\n`;
             xml += `    </item>\n`;
        });
    }

    const reversedFills = [...layer.fills].reverse();
    reversedFills.forEach((fill) => {
        if (!fill.visible) return;
        xml += `    <item>\n`;
        xml += `        <shape android:shape="rectangle">\n`;
        
        if (fill.type === 'solid') {
            xml += `            <solid android:color="${toAndroidHex(fill.value as string)}" />\n`;
        } else {
            xml += generateShapeGradient(fill.value as Gradient, layer.width, layer.height);
        }
        xml += generateCorners(layer.corners);
        xml += `        </shape>\n`;
        xml += `    </item>\n`;
    });
    
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
    xml += `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n`;
    const fill = layer.fills[0];
    if (fill) {
         if (fill.type === 'solid') {
            xml += `    <solid android:color="${toAndroidHex(fill.value as string)}" />\n`;
        } else {
            xml += generateShapeGradient(fill.value as Gradient, layer.width, layer.height);
        }
    }
    xml += generateCorners(layer.corners);
    xml += `</shape>`;
  }
  return xml;
};

// --- Vector XML Generation (For Advanced Elliptical Gradients) ---

const parsePositionKeyword = (posStr: string): { x: number, y: number } | null => {
    if (!posStr) return null;
    const parts = posStr.trim().split(/\s+/);
    
    const mapKeyword = (k: string) => {
        if (k === 'center') return 0.5;
        if (k === 'left' || k === 'top') return 0.0;
        if (k === 'right' || k === 'bottom') return 1.0;
        return null;
    };
    const parseVal = (val: string) => {
        const num = parseFloat(val);
        if (!isNaN(num)) return num / 100;
        const k = mapKeyword(val);
        return k !== null ? k : 0.5;
    }

    if (parts.length === 1) {
        return { x: parseVal(parts[0]), y: 0.5 };
    } else if (parts.length >= 2) {
         return { x: parseVal(parts[0]), y: parseVal(parts[1]) };
    }
    return { x: 0.5, y: 0.5 };
};

const getRoundedRectPath = (w: number, h: number, corners: Corners | number): string => {
    // Generate Path Data for a Rounded Rectangle
    // Simplification: Using max uniform radius for path if object provided, or per-corner if ambitious.
    // Let's stick to uniform/max to keep string length sane for now, or implement full logic.
    let rTopLeft = 0, rTopRight = 0, rBottomRight = 0, rBottomLeft = 0;
    
    if (typeof corners === 'number') {
        rTopLeft = rTopRight = rBottomRight = rBottomLeft = corners;
    } else {
        rTopLeft = corners.topLeft;
        rTopRight = corners.topRight;
        rBottomRight = corners.bottomRight;
        rBottomLeft = corners.bottomLeft;
    }

    // SVG Path Command for Rounded Rect
    // M x+r, y
    // L w-r, y
    // A r,r 0 0 1 w, y+r
    // L w, h-r
    // A r,r 0 0 1 w-r, h
    // L x+r, h
    // A r,r 0 0 1 x, h-r
    // L x, y+r
    // A r,r 0 0 1 x+r, y
    // Z
    
    const p = (val: number) => Math.round(val * 100) / 100; // precision

    return `M${p(rTopLeft)},0 ` +
           `H${p(w - rTopRight)} ` +
           `A${p(rTopRight)},${p(rTopRight)} 0 0 1 ${p(w)},${p(rTopRight)} ` +
           `V${p(h - rBottomRight)} ` +
           `A${p(rBottomRight)},${p(rBottomRight)} 0 0 1 ${p(w - rBottomRight)},${p(h)} ` +
           `H${p(rBottomLeft)} ` +
           `A${p(rBottomLeft)},${p(rBottomLeft)} 0 0 1 0,${p(h - rBottomLeft)} ` +
           `V${p(rTopLeft)} ` +
           `A${p(rTopLeft)},${p(rTopLeft)} 0 0 1 ${p(rTopLeft)},0 ` +
           `Z`;
};

const generateVectorXML = (layer: FigmaLayer): string => {
    const w = Math.round(layer.width);
    const h = Math.round(layer.height);
    
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<!-- Generated from Figma (Vector Mode for Elliptical Gradients) -->\n`;
    xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n`;
    xml += `    xmlns:aapt="http://schemas.android.com/aapt"\n`;
    xml += `    android:width="${w}dp"\n`;
    xml += `    android:height="${h}dp"\n`;
    xml += `    android:viewportWidth="${w}"\n`;
    xml += `    android:viewportHeight="${h}">\n`;

    // 1. Clip Path (To enforce rounded corners on all content)
    const clipPathData = getRoundedRectPath(w, h, layer.corners);
    xml += `    <clip-path android:pathData="${clipPathData}" />\n`;

    // 2. Render Fills (Bottom up)
    const reversedFills = [...layer.fills].reverse();

    reversedFills.forEach((fill, index) => {
        if (!fill.visible) return;
        
        if (fill.type === 'solid') {
            const hex = toAndroidHex(fill.value as string);
            xml += `    <path\n`;
            xml += `        android:pathData="M0,0 h${w} v${h} h-${w} z"\n`;
            xml += `        android:fillColor="${hex}" />\n`;
        } else {
            const gradient = fill.value as Gradient;
            const stops = gradient.stops;
            const rawStart = getColorAtPosition(stops, 0);
            const rawEnd = getColorAtPosition(stops, 100);
            const rawCenter = getColorAtPosition(stops, 50);
            
            const startColor = toAndroidHex(rawStart, rawCenter);
            const centerColor = toAndroidHex(rawCenter);
            const endColor = toAndroidHex(rawEnd, rawCenter);

            if (gradient.type === GradientType.Linear) {
                // Linear Gradient in Vector
                // Calculate coords based on angle
                const angleRad = ((gradient.angle || 180) - 90) * (Math.PI / 180);
                // Center
                const cx = w/2;
                const cy = h/2;
                // Length of diagonal
                const r = Math.sqrt(w*w + h*h) / 2;
                
                const startX = cx - r * Math.cos(angleRad);
                const startY = cy - r * Math.sin(angleRad);
                const endX = cx + r * Math.cos(angleRad);
                const endY = cy + r * Math.sin(angleRad);
                
                xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z">\n`;
                xml += `      <aapt:attr name="android:fillColor">\n`;
                xml += `        <gradient\n`;
                xml += `          android:type="linear"\n`;
                xml += `          android:startX="${startX.toFixed(1)}"\n`;
                xml += `          android:startY="${startY.toFixed(1)}"\n`;
                xml += `          android:endX="${endX.toFixed(1)}"\n`;
                xml += `          android:endY="${endY.toFixed(1)}"\n`;
                xml += `          android:startColor="${startColor}"\n`;
                if (stops.length > 2) xml += `          android:centerColor="${centerColor}"\n`;
                xml += `          android:endColor="${endColor}" />\n`;
                xml += `      </aapt:attr>\n`;
                xml += `    </path>\n`;

            } else {
                // Radial Gradient (The Complex Part)
                let scaleX = 1;
                let scaleY = 1;
                let centerX = 0.5;
                let centerY = 0.5;
                let radiusX = w/2;
                let radiusY = h/2;

                if (gradient.rawGeometry) {
                     // Parse dimensions
                     const matches = gradient.rawGeometry.match(/(\d+(?:\.\d+)?)(%|px)/g);
                     if (matches && matches.length > 0) {
                         matches.forEach((m, i) => {
                             const val = parseFloat(m);
                             const pxVal = m.includes('%') 
                                ? (val/100) * (i===0 ? w : h) 
                                : val;
                             if (i === 0) radiusX = pxVal;
                             if (i === 1 || matches.length === 1) radiusY = pxVal;
                         });
                     }
                     // Parse position
                     const atIndex = gradient.rawGeometry.indexOf('at ');
                     if (atIndex !== -1) {
                        const pos = parsePositionKeyword(gradient.rawGeometry.substring(atIndex + 3));
                        if (pos) { centerX = pos.x; centerY = pos.y; }
                     }
                }
                
                // Vector Logic:
                // We draw a UNIT circle (r=100) centered at 0,0.
                // We apply a Group Transform to scale/translate it to the target ellipse.
                const baseR = 100;
                const sx = radiusX / baseR;
                const sy = radiusY / baseR;
                
                const tx = centerX * w;
                const ty = centerY * h;
                
                xml += `    <group\n`;
                xml += `        android:translateX="${tx.toFixed(1)}"\n`;
                xml += `        android:translateY="${ty.toFixed(1)}"\n`;
                xml += `        android:scaleX="${sx.toFixed(4)}"\n`;
                xml += `        android:scaleY="${sy.toFixed(4)}">\n`;
                xml += `        <path\n`;
                // Circle path of radius 100 centered at 0,0
                xml += `            android:pathData="M 0,-100 A 100,100 0 1 1 0,100 A 100,100 0 1 1 0,-100"\n`; 
                xml += `            >\n`;
                xml += `          <aapt:attr name="android:fillColor">\n`;
                xml += `            <gradient\n`;
                xml += `              android:type="radial"\n`;
                xml += `              android:centerX="0"\n`;
                xml += `              android:centerY="0"\n`;
                xml += `              android:gradientRadius="100"\n`;
                xml += `              android:startColor="${startColor}"\n`;
                if (stops.length > 2) xml += `              android:centerColor="${centerColor}"\n`;
                xml += `              android:endColor="${endColor}" />\n`;
                xml += `          </aapt:attr>\n`;
                xml += `        </path>\n`;
                xml += `    </group>\n`;
            }
        }
    });

    xml += `</vector>`;
    return xml;
};

// --- Main Switcher ---

const hasEllipticalGradient = (layer: FigmaLayer): boolean => {
    return layer.fills.some(fill => {
        if (fill.type !== 'gradient') return false;
        const g = fill.value as Gradient;
        if (g.type !== GradientType.Radial) return false;
        if (!g.rawGeometry) return false;
        
        // Check for non-uniform size definitions (e.g., "67% 100%")
        // Simple check: if it has two percentage/px values that are different
        const matches = g.rawGeometry.match(/(\d+(?:\.\d+)?)(%|px)/g);
        if (matches && matches.length >= 2) {
             // If we have 2 explicit dimensions, we assume user might intend ellipse.
             // We can check if they map to similar pixels, but let's be aggressive for fidelity.
             return true; 
        }
        return false;
    });
};

export const generateAndroidXML = (layer: FigmaLayer): string => {
  // If the layer uses complex elliptical radial gradients, use VectorDrawable (API 24+)
  // otherwise use standard Shape Drawable (API 21+)
  if (hasEllipticalGradient(layer)) {
      return generateVectorXML(layer);
  }
  return generateShapeXML(layer);
};
