import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

// Android Hex is #AARRGGBB, CSS is #RRGGBB or rgba
const toAndroidHex = (cssColor: string): string => {
  // Fast path for Hex
  if (cssColor.startsWith('#')) {
    if (cssColor.length === 7) return '#FF' + cssColor.substring(1).toUpperCase();
    if (cssColor.length === 9) return cssColor.toUpperCase(); // Already has alpha? CSS usually doesn't output #RRGGBBAA widely yet but possible
    if (cssColor.length === 4) {
      // #RGB -> #FFRRGGBB
      const r = cssColor[1];
      const g = cssColor[2];
      const b = cssColor[3];
      return `#FF${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return '#FF' + cssColor.substring(1).toUpperCase();
  }

  // Regex for rgba(r, g, b, a) or rgb(r, g, b)
  // Handles spaces freely: rgba( 255 , 0 , 0 , 0.5 )
  const match = cssColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    
    // If alpha group (index 4) is undefined, it means rgb() which is alpha 1
    const aVal = match[4] !== undefined ? parseFloat(match[4]) : 1;
    
    const alphaInt = Math.round(aVal * 255);
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    
    return `#${toHex(alphaInt)}${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  // Fallback to canvas for named colors (red, blue, transparent)
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#FF000000';
  ctx.fillStyle = cssColor;
  const computed = ctx.fillStyle; 
  
  if (computed.startsWith('#')) {
     if (computed.length === 7) return '#FF' + computed.substring(1).toUpperCase();
     return computed.toUpperCase();
  }
  // If canvas returns rgba (e.g. transparent), recurse
  if (computed.startsWith('rgba') && computed !== cssColor) {
     return toAndroidHex(computed);
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
  
  // 1. Sort stops by position
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);
  
  if (sortedStops.length === 0) return '';

  const startColor = toAndroidHex(sortedStops[0].color);
  // Fix: Ensure we grab the actual last one
  const endColor = toAndroidHex(sortedStops[sortedStops.length - 1].color);
  
  let centerAttr = '';
  
  // Android Gradient limitation: only 3 colors (start, center, end) usually supported in standard <shape>
  // unless API 24+ attributes are used. We stick to API 21+ compatible standard attributes.
  if (sortedStops.length >= 3) {
    const middleIndex = Math.floor((sortedStops.length - 1) / 2);
    // Find the stop closest to 50%? Or just the middle index.
    const middleStop = sortedStops[middleIndex];
    const centerHex = toAndroidHex(middleStop.color);
    centerAttr = `\n        android:centerColor="${centerHex}"`;
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
  
  const needsLayerList = layer.fills.length > 1 || layer.shadows.length > 0;
  
  if (needsLayerList) {
    xml += `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n`;
    
    // 1. Drop Shadows (Bottom layer)
    const dropShadows = layer.shadows.filter(s => s.type === 'drop' && s.visible);
    const innerShadows = layer.shadows.filter(s => s.type === 'inner' && s.visible);
    
    if (dropShadows.length > 0) {
        xml += `    <!-- ⚠️ Note: Drop Shadows in XML are approximations. Prefer android:elevation on the View. -->\n`;
        dropShadows.forEach((shadow, idx) => {
             xml += `    <item android:left="${shadow.x}dp" android:top="${shadow.y}dp">\n`;
             xml += `        <shape android:shape="rectangle">\n`;
             xml += `            <solid android:color="${toAndroidHex(shadow.color)}" />\n`;
             xml += `            <corners android:radius="${typeof layer.corners === 'number' ? layer.corners : layer.corners.topLeft}dp" />\n`;
             xml += `        </shape>\n`;
             xml += `    </item>\n`;
        });
    }

    // 2. Fills (CSS Top->Bottom, Android Bottom->Top, so Reverse)
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
    
    // 3. Inner Shadows (Overlay)
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
