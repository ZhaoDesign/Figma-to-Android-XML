import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

// Android Hex is #AARRGGBB, CSS is #RRGGBB or rgba
const toAndroidHex = (cssColor: string): string => {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#FF000000';
  ctx.fillStyle = cssColor;
  // This computes to #RRGGBB or rgba(r,g,b,a) format
  const computed = ctx.fillStyle; 
  
  if (computed.startsWith('#')) {
    // #RRGGBB -> #FFRRGGBB
    if (computed.length === 7) return '#FF' + computed.substring(1).toUpperCase();
    return computed.toUpperCase();
  }
  
  // Handle rgba? The canvas context normally converts rgba to hex if alpha is 1, 
  // but let's parse raw rgba if needed or stick to a simple converter.
  // For robustness, let's use a temporary DOM element opacity trick or regex
  // A regex for rgba(r, g, b, a)
  const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const a = match[4] ? parseFloat(match[4]) : 1;
    
    const alphaInt = Math.round(a * 255);
    const hex = (
      (alphaInt << 24) |
      (r << 16) |
      (g << 8) |
      b
    ).toString(16).toUpperCase().padStart(8, '0'); // padStart ensures leading zeros
    // bitwise operation in JS acts on 32-bit signed ints, causing issues with high alpha.
    // Safer string manipulation:
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(alphaInt)}${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  return '#FF000000';
};

const mapAngle = (cssDeg: number): number => {
  // CSS: 0 = Top, 90 = Right, 180 = Bottom
  // Android: 0 = Right, 90 = Top, 180 = Left, 270 = Bottom
  // Relation: Android = (450 - CSS) % 360
  
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
  const { angle = 180, stops, type } = gradient;
  
  // Android limitation: shape gradients primarily support start/center/end or API 24+ item arrays.
  // We will aim for standard <gradient> tag compatibility (API 21+).
  
  // 1. Sort stops by position
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);
  
  if (sortedStops.length === 0) return '';

  const startColor = toAndroidHex(sortedStops[0].color);
  const endColor = toAndroidHex(sortedStops[sortedStops.length - 1].color);
  
  let centerAttr = '';
  
  if (sortedStops.length >= 3) {
    // Pick the middle-most stop
    const middleStop = sortedStops[Math.floor((sortedStops.length - 1) / 2)];
    const centerHex = toAndroidHex(middleStop.color);
    centerAttr = `\n        android:centerColor="${centerHex}"`;
    // Note: android:centerY is 0.5 by default
  }

  let typeAttr = '';
  let angleAttr = '';
  
  if (type === GradientType.Radial) {
    typeAttr = 'android:type="radial"';
    angleAttr = 'android:gradientRadius="50%p"'; // approximation
  } else {
    // Linear
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
  
  // Do we need a layer list?
  // We need it if:
  // 1. More than 1 fill
  // 2. Shadows (simulated via items)
  // 3. To handle render order (CSS: Top->Bottom, Android LayerList: Bottom->Top)
  
  const needsLayerList = layer.fills.length > 1 || layer.shadows.length > 0;
  
  if (needsLayerList) {
    xml += `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n`;
    
    // 1. Handle Shadows (Drop shadows are placed 'behind' the main shape in layer list, 
    // but typically Android uses `elevation`. If we MUST emulate in XML, we use offset items with transparent gradients.
    // For this strict implementation, we will add a comment for Drop Shadow and try to implement it if simple.
    // Inner shadow is on TOP of content.
    
    const dropShadows = layer.shadows.filter(s => s.type === 'drop' && s.visible);
    const innerShadows = layer.shadows.filter(s => s.type === 'inner' && s.visible);
    
    if (dropShadows.length > 0) {
        xml += `    <!-- ⚠️ Note: Drop Shadows in XML are approximations. Prefer android:elevation on the View. -->\n`;
        // We can simulate a simple shadow with a shape shifted by inset
        dropShadows.forEach((shadow, idx) => {
             xml += `    <item android:left="${shadow.x}dp" android:top="${shadow.y}dp">\n`;
             xml += `        <shape android:shape="rectangle">\n`;
             xml += `            <solid android:color="${toAndroidHex(shadow.color)}" />\n`;
             xml += `            <corners android:radius="${typeof layer.corners === 'number' ? layer.corners : layer.corners.topLeft}dp" />\n`;
             xml += `        </shape>\n`;
             xml += `    </item>\n`;
        });
    }

    // 2. Handle Fills. 
    // CSS Fills are Top -> Bottom.
    // Android Layer List paints Order 0 (Bottom) -> Order N (Top).
    // So we reverse the CSS fills array.
    const reversedFills = [...layer.fills].reverse();
    
    reversedFills.forEach((fill, index) => {
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
    
    // 3. Handle Inner Shadows (Overlay)
    // Inner shadows are essentially a gradient or stroke drawn ON TOP.
    // Approximating inner shadow in XML is hard without `stroke` hacks.
    if (innerShadows.length > 0) {
        xml += `    <!-- ⚠️ Inner Shadow approximation -->\n`;
        innerShadows.forEach(shadow => {
            // A common hack is a stroke with a gradient, but that's complex.
            // We'll just put a placeholder item or a translucent overlay.
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
