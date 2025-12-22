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
        const b = parseInt(computed.slice(1,3), 16); // fix typo
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
           `A${p(rTR)},${p(rTR) || 0.01} 0 0 1 ${p(width+i)},${p(rTR+i)} ` +
           `V${p(height-rBR+i)} ` +
           `A${p(rBR)},${p(rBR) || 0.01} 0 0 1 ${p(width-rBR+i)},${p(height+i)} ` +
           `H${p(rBL+i)} ` +
           `A${p(rBL)},${p(rBL) || 0.01} 0 0 1 ${p(i)},${p(height-rBL+i)} ` +
           `V${p(rTL+i)} ` +
           `A${p(rTL)},${p(rTL) || 0.01} 0 0 1 ${p(rTL+i)},${p(i)} Z`;
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

            const centerX = (g.center?.x ?? 50) * w / 100;
            const centerY = (g.center?.y ?? 50) * h / 100;
            
            // For Elliptical Conic (Sweep) or Radial gradients
            const isElliptical = w !== h;
            const scaleFactor = isElliptical ? h / w : 1;

            xml += `    <group android:pivotX="${centerX.toFixed(2)}" android:pivotY="${centerY.toFixed(2)}"\n`;
            
            if (g.type === GradientType.Angular) {
                // Offset by -90 because Android sweep starts at 3 o'clock, CSS at 12 o'clock
                const rotation = (g.angle || 0) - 90;
                xml += `           android:rotation="${rotation.toFixed(2)}"\n`;
            }
            
            if (isElliptical && (g.type === GradientType.Angular || g.type === GradientType.Radial || g.type === GradientType.Diamond)) {
                // To squash correctly, we scale the Y axis around the pivot
                xml += `           android:scaleY="${scaleFactor.toFixed(4)}"\n`;
            }
            xml += `    >\n`;

            // Draw a rectangle that covers the area after scaling. 
            // If we're scaling Y down, the source rectangle must be wider/taller to compensate
            const fillBounds = Math.max(w, h) * 2;
            const fillX = centerX - fillBounds / 2;
            const fillY = centerY - fillBounds / 2;

            xml += `        <path android:pathData="M${fillX.toFixed(1)},${fillY.toFixed(1)} h${fillBounds.toFixed(1)} v${fillBounds.toFixed(1)} h-${fillBounds.toFixed(1)} z">\n`;
            xml += `            <aapt:attr name="android:fillColor">\n`;
            xml += `                <gradient android:type="${androidType}"\n`;
            xml += `                          android:centerX="${centerX.toFixed(2)}"\n`;
            xml += `                          android:centerY="${centerY.toFixed(2)}"\n`;
            
            if (g.type === GradientType.Radial || g.type === GradientType.Diamond) {
                const radius = Math.max(w, h) / 2;
                xml += `                          android:gradientRadius="${radius.toFixed(1)}"\n`;
            }
            
            if (g.stops.length > 2) {
                g.stops.sort((a,b) => a.position - b.position).forEach(stop => {
                    xml += `                    <item android:color="${toAndroidHex(stop.color)}" android:offset="${(stop.position / 100).toFixed(4)}" />\n`;
                });
            } else {
                xml += `                          android:startColor="${toAndroidHex(g.stops[0].color)}"\n`;
                xml += `                          android:endColor="${toAndroidHex(g.stops[g.stops.length-1].color)}" />\n`;
            }
            
            if (g.stops.length > 2) xml += `                </gradient>\n`;
            xml += `            </aapt:attr>\n`;
            xml += `        </path>\n`;
            xml += `    </group>\n`;
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