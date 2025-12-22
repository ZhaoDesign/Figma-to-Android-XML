import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

const toAndroidHex = (cssColor: string, forceRgbFrom?: string): string => {
  const getRgba = (c: string) => {
    if (c.startsWith('#') && c.length === 9) {
        const r = parseInt(c.slice(1,3), 16), g = parseInt(c.slice(3,5), 16), b = parseInt(c.slice(5,7), 16), a = parseInt(c.slice(7,9), 16) / 255;
        return {r,g,b,a};
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return {r:0,g:0,b:0,a:1};
    ctx.fillStyle = c;
    let computed = ctx.fillStyle; 
    if (computed.startsWith('#')) return {r: parseInt(computed.slice(1,3), 16), g: parseInt(computed.slice(3,5), 16), b: parseInt(computed.slice(5,7), 16), a:1};
    if (computed.startsWith('rgba')) {
        const parts = computed.match(/[\d.]+/g);
        if (parts && parts.length >= 4) return {r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]), a: parseFloat(parts[3])};
    }
    return {r:0, g:0, b:0, a:1};
  };
  const current = getRgba(cssColor);
  const isTransparentBlack = current.a <= 0.01 && (current.r + current.g + current.b) < 10;
  if (isTransparentBlack && forceRgbFrom) {
      const n = getRgba(forceRgbFrom);
      const toHex = (num: number) => Math.round(num).toString(16).padStart(2, '0').toUpperCase();
      return `#00${toHex(n.r)}${toHex(n.g)}${toHex(n.b)}`;
  }
  const toHex = (num: number) => Math.round(num).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(current.a * 255)}${toHex(current.r)}${toHex(current.g)}${toHex(current.b)}`;
};

const getRoundedRectPath = (w: number, h: number, corners: Corners | number): string => {
    let rTL = 0, rTR = 0, rBR = 0, rBL = 0;
    if (typeof corners === 'number') rTL = rTR = rBR = rBL = corners;
    else { rTL = corners.topLeft; rTR = corners.topRight; rBR = corners.bottomRight; rBL = corners.bottomLeft; }
    const p = (v: number) => Math.round(v * 100) / 100;
    return `M${p(rTL)},0 H${p(w-rTR)} A${p(rTR)},${p(rTR)} 0 0 1 ${p(w)},${p(rTR)} V${p(h-rBR)} A${p(rBR)},${p(rBR)} 0 0 1 ${p(w-rBR)},${p(h)} H${p(rBL)} A${p(rBL)},${p(rBL)} 0 0 1 0,${p(h-rBL)} V${p(rTL)} A${p(rTL)},${p(rTL)} 0 0 1 ${p(rTL)},0 Z`;
};

const getColorAtPosition = (stops: ColorStop[], targetPos: number): string => {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    if (targetPos <= sorted[0].position) return sorted[0].color;
    if (targetPos >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
    return sorted[0].color; // Simplified
};

const generateVectorXML = (layer: FigmaLayer): string => {
    const w = Math.round(layer.width), h = Math.round(layer.height);
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from Figma Advanced (Vector Mode) -->\n`;
    xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt"\n`;
    xml += `    android:width="${w}dp" android:height="${h}dp" android:viewportWidth="${w}" android:viewportHeight="${h}">\n`;

    if (layer.backdropBlur) xml += `    <!-- Note: Background Blur (${layer.backdropBlur}dp) requires RenderEffect (API 31+) or specialized View groups -->\n`;
    if (layer.blur) xml += `    <!-- Note: Layer Blur (${layer.blur}dp) requires View.setRenderEffect(RenderEffect.createBlurEffect(...)) -->\n`;

    // Drop Shadows approximation
    layer.shadows.filter(s => s.type === 'drop' && s.visible).forEach((s, i) => {
        const path = getRoundedRectPath(w + s.spread * 2, h + s.spread * 2, layer.corners);
        xml += `    <group android:translateX="${s.x - s.spread}" android:translateY="${s.y - s.spread}">\n`;
        xml += `        <path android:pathData="${path}" android:fillColor="${toAndroidHex(s.color)}" android:fillAlpha="0.5" />\n`;
        xml += `    </group>\n`;
    });

    const clipPath = getRoundedRectPath(w, h, layer.corners);
    xml += `    <clip-path android:pathData="${clipPath}" />\n`;

    [...layer.fills].reverse().forEach((fill) => {
        if (!fill.visible) return;
        if (fill.type === 'noise' || fill.type === 'texture') {
            xml += `    <!-- Fill: ${fill.type.toUpperCase()} (Recommend using Bitmap with tileMode="repeat") -->\n`;
        }
        if (fill.type === 'solid') {
            xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z" android:fillColor="${toAndroidHex(fill.value as string)}" />\n`;
        } else if (fill.type === 'gradient') {
            const g = fill.value as Gradient;
            xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z">\n`;
            xml += `      <aapt:attr name="android:fillColor">\n`;
            xml += `        <gradient android:type="${g.type}" android:startColor="${toAndroidHex(g.stops[0].color)}" android:endColor="${toAndroidHex(g.stops[g.stops.length-1].color)}" />\n`;
            xml += `      </aapt:attr>\n`;
            xml += `    </path>\n`;
        }
    });

    // Inner Shadows approximation
    layer.shadows.filter(s => s.type === 'inner' && s.visible).forEach((s) => {
        xml += `    <!-- Inner Shadow Approximation: ${s.x}x ${s.y}y blur:${s.blur} -->\n`;
        xml += `    <path android:pathData="${clipPath}" android:strokeWidth="${s.blur}" android:strokeColor="${toAndroidHex(s.color)}" />\n`;
    });

    xml += `</vector>`;
    return xml;
};

export const generateAndroidXML = (layer: FigmaLayer): string => {
  // Always use Vector for comprehensive feature support (Shadows, Blur info, etc.)
  return generateVectorXML(layer);
};
