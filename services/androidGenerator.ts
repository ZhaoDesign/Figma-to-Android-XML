import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Corners, Shadow } from '../types';

const toAndroidHex = (cssColor: string, forceRgbFrom?: string): string => {
  const getRgba = (c: string) => {
    if (c.startsWith('#') && (c.length === 7 || c.length === 9)) {
        let r, g, b, a = 1;
        if (c.length === 7) {
            r = parseInt(c.slice(1,3), 16);
            g = parseInt(c.slice(3,5), 16);
            b = parseInt(c.slice(5,7), 16);
        } else {
            r = parseInt(c.slice(1,3), 16);
            g = parseInt(c.slice(3,5), 16);
            b = parseInt(c.slice(5,7), 16);
            a = parseInt(c.slice(7,9), 16) / 255;
        }
        return {r,g,b,a};
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return {r:0,g:0,b:0,a:1};
    ctx.fillStyle = c;
    const computed = ctx.fillStyle; 
    if (computed.startsWith('#')) {
        return {r: parseInt(computed.slice(1,3), 16), g: parseInt(computed.slice(3,5), 16), b: parseInt(computed.slice(5,7), 16), a:1};
    }
    const parts = computed.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
        return {r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]), a: parts[3] ? parseFloat(parts[3]) : 1};
    }
    return {r:0, g:0, b:0, a:1};
  };

  const current = getRgba(cssColor);
  const toHex = (num: number) => Math.round(num).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(current.a * 255)}${toHex(current.r)}${toHex(current.g)}${toHex(current.b)}`;
};

const getRoundedRectPath = (w: number, h: number, corners: Corners | number, inset: number = 0): string => {
    let rTL = 0, rTR = 0, rBR = 0, rBL = 0;
    const i = inset;
    if (typeof corners === 'number') {
        rTL = rTR = rBR = rBL = Math.max(0, corners - i);
    } else {
        rTL = Math.max(0, corners.topLeft - i);
        rTR = Math.max(0, corners.topRight - i);
        rBR = Math.max(0, corners.bottomRight - i);
        rBL = Math.max(0, corners.bottomLeft - i);
    }
    const p = (v: number) => Math.round(v * 100) / 100;
    const width = w - i*2;
    const height = h - i*2;

    return `M${p(rTL+i)},${p(i)} ` +
           `H${p(width-rTR+i)} ` +
           `A${p(rTR)},${p(rTR)} 0 0 1 ${p(width+i)},${p(rTR+i)} ` +
           `V${p(height-rBR+i)} ` +
           `A${p(rBR)},${p(rBR)} 0 0 1 ${p(width-rBR+i)},${p(height+i)} ` +
           `H${p(rBL+i)} ` +
           `A${p(rBL)},${p(rBL)} 0 0 1 ${p(i)},${p(height-rBL+i)} ` +
           `V${p(rTL+i)} ` +
           `A${p(rTL)},${p(rTL)} 0 0 1 ${p(rTL+i)},${p(i)} Z`;
};

export const generateAndroidXML = (layer: FigmaLayer): string => {
    const w = Math.round(layer.width);
    const h = Math.round(layer.height);
    
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<!-- Generated from Figma Advanced (Vector Mode) -->\n`;
    xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n`;
    xml += `    xmlns:aapt="http://schemas.android.com/aapt"\n`;
    xml += `    android:width="${w}dp" android:height="${h}dp"\n`;
    xml += `    android:viewportWidth="${w}" android:viewportHeight="${h}">\n\n`;

    // Blur Info
    if (layer.backdropBlur) xml += `    <!-- Note: Backdrop Blur (${layer.backdropBlur}dp) requires RenderEffect API 31+ -->\n`;
    if (layer.blur) xml += `    <!-- Note: Layer Blur (${layer.blur}dp) requires RenderEffect API 31+ -->\n`;

    // 1. Drop Shadows (Rendered as offset paths)
    layer.shadows.filter(s => s.type === 'drop' && s.visible).forEach((s, idx) => {
        const shadowPath = getRoundedRectPath(w + s.spread * 2, h + s.spread * 2, layer.corners);
        xml += `    <!-- Drop Shadow ${idx + 1} -->\n`;
        xml += `    <group android:translateX="${s.x - s.spread}" android:translateY="${s.y - s.spread}">\n`;
        xml += `        <path android:pathData="${shadowPath}"\n`;
        xml += `              android:fillColor="${toAndroidHex(s.color)}"\n`;
        xml += `              android:fillAlpha="${s.blur > 0 ? '0.6' : '1.0'}" />\n`;
        xml += `    </group>\n`;
    });

    // 2. Main Content Clipping
    const mainClipPath = getRoundedRectPath(w, h, layer.corners);
    xml += `    <clip-path android:pathData="${mainClipPath}" />\n\n`;

    // 3. Fills (Bottom to Top)
    [...layer.fills].reverse().forEach((fill, idx) => {
        if (!fill.visible) return;
        
        xml += `    <!-- Fill Layer ${idx + 1}: ${fill.type.toUpperCase()} -->\n`;
        if (fill.type === 'noise' || fill.type === 'texture') {
            xml += `    <!-- Note: Textures require <bitmap> with tileMode="repeat" in a layer-list -->\n`;
        }

        if (fill.type === 'solid') {
            xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z"\n`;
            xml += `          android:fillColor="${toAndroidHex(fill.value as string)}" />\n`;
        } else if (fill.type === 'gradient') {
            const g = fill.value as Gradient;
            xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z">\n`;
            xml += `        <aapt:attr name="android:fillColor">\n`;
            xml += `            <gradient android:type="${g.type === GradientType.Linear ? 'linear' : 'radial'}"\n`;
            xml += `                      android:startColor="${toAndroidHex(g.stops[0].color)}"\n`;
            xml += `                      android:endColor="${toAndroidHex(g.stops[g.stops.length-1].color)}" />\n`;
            xml += `        </aapt:attr>\n`;
            xml += `    </path>\n`;
        }
    });

    // 4. Inner Shadows (Approximated with thick internal strokes)
    layer.shadows.filter(s => s.type === 'inner' && s.visible).forEach((s, idx) => {
        xml += `\n    <!-- Inner Shadow ${idx + 1} (Approximation) -->\n`;
        // To simulate inner shadow, we draw a stroke along the clip path but offset inwards
        xml += `    <path android:pathData="${mainClipPath}"\n`;
        xml += `          android:strokeWidth="${s.blur * 2}"\n`;
        xml += `          android:strokeColor="${toAndroidHex(s.color)}"\n`;
        xml += `          android:translateX="${s.x}"\n`;
        xml += `          android:translateY="${s.y}" />\n`;
    });

    xml += `\n</vector>`;
    return xml;
};
