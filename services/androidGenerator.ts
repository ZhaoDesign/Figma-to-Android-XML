import { FigmaLayer, Fill, Gradient, GradientType, Corners, Shadow } from '../types';

const toAndroidHex = (cssColor: string): string => {
  const getRgba = (c: string) => {
    if (c.startsWith('#')) {
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
        const r = parseInt(computed.slice(1,3), 16);
        const g = parseInt(computed.slice(3,5), 16);
        const b = parseInt(computed.slice(5,7), 16);
        return {r, g, b, a:1};
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
    const i = inset;
    let rTL, rTR, rBR, rBL;
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
    const isElliptical = w !== h;
    
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<!-- Generated from Figma Advanced (Vector Mode) -->\n`;
    xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n`;
    xml += `    xmlns:aapt="http://schemas.android.com/aapt"\n`;
    xml += `    android:width="${w}dp" android:height="${h}dp"\n`;
    xml += `    android:viewportWidth="${w}" android:viewportHeight="${h}">\n\n`;

    // 1. Drop Shadows
    layer.shadows.filter(s => s.type === 'drop' && s.visible).forEach((s, idx) => {
        const shadowPath = getRoundedRectPath(w + s.spread * 2, h + s.spread * 2, layer.corners);
        xml += `    <!-- Drop Shadow ${idx + 1} -->\n`;
        xml += `    <group android:translateX="${s.x - s.spread}" android:translateY="${s.y - s.spread}">\n`;
        xml += `        <path android:pathData="${shadowPath}"\n`;
        xml += `              android:fillColor="${toAndroidHex(s.color)}"\n`;
        xml += `              android:fillAlpha="${s.blur > 0 ? '0.4' : '1.0'}" />\n`;
        xml += `    </group>\n`;
    });

    // 2. Main Content Clipping
    const mainPath = getRoundedRectPath(w, h, layer.corners);
    xml += `    <clip-path android:pathData="${mainPath}" />\n\n`;

    // 3. Fills
    [...layer.fills].reverse().forEach((fill, idx) => {
        if (!fill.visible) return;
        
        xml += `    <!-- Fill ${idx + 1}: ${fill.type.toUpperCase()} (Blend: ${fill.blendMode || 'normal'}) -->\n`;

        if (fill.type === 'solid') {
            xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z"\n`;
            xml += `          android:fillColor="${toAndroidHex(fill.value as string)}" />\n`;
        } else if (fill.type === 'gradient') {
            const g = fill.value as Gradient;
            let androidType = 'linear';
            if (g.type === GradientType.Radial || g.type === GradientType.Diamond) androidType = 'radial';
            if (g.type === GradientType.Angular) androidType = 'sweep';

            const needsScaling = (g.type === GradientType.Radial || g.type === GradientType.Angular || g.type === GradientType.Diamond) && isElliptical;

            if (needsScaling) {
                const scaleY = h / w;
                const translateY = (h - (h * scaleY)) / 2; // Approximation to center scaled gradient
                xml += `    <group android:scaleY="${scaleY.toFixed(3)}" android:translateY="${translateY.toFixed(3)}">\n`;
            }

            xml += `        <path android:pathData="M0,0 h${w} v${h} h-${w} z">\n`;
            xml += `            <aapt:attr name="android:fillColor">\n`;
            xml += `                <gradient android:type="${androidType}"\n`;
            if (g.type === GradientType.Radial || g.type === GradientType.Diamond) {
                const radius = Math.max(w, h) / 2;
                xml += `                          android:centerX="${w / 2}"\n`;
                xml += `                          android:centerY="${h / 2}"\n`;
                xml += `                          android:gradientRadius="${radius.toFixed(1)}"\n`;
            }
            xml += `                          android:startColor="${toAndroidHex(g.stops[0].color)}"\n`;
            xml += `                          android:endColor="${toAndroidHex(g.stops[g.stops.length-1].color)}" />\n`;
            xml += `            </aapt:attr>\n`;
            xml += `        </path>\n`;

            if (needsScaling) {
                xml += `    </group>\n`;
            }
        }
    });

    // 4. Inner Shadows
    layer.shadows.filter(s => s.type === 'inner' && s.visible).forEach((s, idx) => {
        const strokeWidth = s.blur > 0 ? s.blur * 2 : 2;
        xml += `\n    <!-- Inner Shadow ${idx + 1} Approximation -->\n`;
        xml += `    <path android:pathData="${mainPath}"\n`;
        xml += `          android:fillColor="#00000000"\n`; 
        xml += `          android:strokeWidth="${strokeWidth}"\n`;
        xml += `          android:strokeColor="${toAndroidHex(s.color)}"\n`;
        xml += `          android:translateX="${s.x}"\n`;
        xml += `          android:translateY="${s.y}" />\n`;
    });

    xml += `\n</vector>`;
    return xml;
};