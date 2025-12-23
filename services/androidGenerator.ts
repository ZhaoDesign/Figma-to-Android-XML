
import { FigmaLayer, Fill, Gradient, GradientType, Corners, Shadow } from '../types';

const toAndroidHex = (cssColor: string, overrideOpacity?: number): string => {
  const getRgba = (c: string) => {
    if (c.startsWith('#')) {
        let r, g, b, a = 1;
        if (c.length === 7) {
            r = parseInt(c.slice(1,3), 16);
            g = parseInt(c.slice(3,5), 16);
            b = parseInt(c.slice(5,7), 16);
        } else if (c.length === 9) {
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
  const finalAlpha = overrideOpacity !== undefined ? overrideOpacity : current.a;

  const toHex = (num: number) => Math.round(num).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(finalAlpha * 255)}${toHex(current.r)}${toHex(current.g)}${toHex(current.b)}`;
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
    const mainPath = getRoundedRectPath(w, h, layer.corners);

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<!-- Generated from Figma Advanced (Matrix Re-projection) -->\n`;
    xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n`;
    xml += `    xmlns:aapt="http://schemas.android.com/aapt"\n`;
    xml += `    android:width="${w}dp" android:height="${h}dp"\n`;
    xml += `    android:viewportWidth="${w}" android:viewportHeight="${h}">\n\n`;

    // Drop Shadows
    layer.shadows.filter(s => s.type === 'drop' && s.visible).forEach((s, idx) => {
        const shadowPath = getRoundedRectPath(w + s.spread * 2, h + s.spread * 2, layer.corners);
        xml += `    <group android:translateX="${s.x - s.spread}" android:translateY="${s.y - s.spread}">\n`;
        xml += `        <path android:pathData="${shadowPath}"\n`;
        xml += `              android:fillColor="${toAndroidHex(s.color)}"\n`;
        xml += `              android:fillAlpha="${s.blur > 0 ? '0.4' : '1.0'}" />\n`;
        xml += `    </group>\n`;
    });

    // Global Clipping Path: This is KEY. It clips the massive rectangles we draw below.
    xml += `    <clip-path android:pathData="${mainPath}" />\n\n`;

    // Fills
    layer.fills.forEach((fill, idx) => {
        if (!fill.visible) return;

        xml += `    <!-- Fill ${idx + 1}: ${fill.type.toUpperCase()} -->\n`;

        if (fill.type === 'solid') {
            xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z"\n`;
            xml += `          android:fillColor="${toAndroidHex(fill.value as string)}" />\n`;
        } else if (fill.type === 'gradient') {
            const g = fill.value as Gradient;
            const sortedStops = [...g.stops].sort((a,b) => a.position - b.position);

            // --- Strategy: Matrix Re-projection using Nested Groups ---
            if (g.transform && (g.type === GradientType.Radial || g.type === GradientType.Diamond || g.type === GradientType.Angular)) {
                // Deconstruct Matrix
                const t = g.transform;

                // For Angular, Android 0deg is 3 o'clock. Figma 0deg is X axis. They match geometrically.
                // However, Figma's angular gradient matrix usually scales the unit circle to the bounding box aspect ratio.
                // We use the exact matrix scale to reproduce this "Elliptical Sweep" effect.

                xml += `    <group android:translateX="${t.tx.toFixed(2)}" android:translateY="${t.ty.toFixed(2)}">\n`;
                xml += `        <group android:rotation="${t.rotation.toFixed(2)}">\n`;
                xml += `            <group android:scaleX="${t.scaleX.toFixed(4)}" android:scaleY="${t.scaleY.toFixed(4)}">\n`;

                // Draw a canonical unit box (or large box) in the Local Gradient Space.
                // The groups above transform this box to the correct pixel location, rotation, and size.
                // We use a large rectangle (e.g. -1 to 1 normalized, or larger to cover) to ensure coverage.
                // Since our transform scales Unit -> Pixels, drawing -1 to 1 covers the gradient area.
                // For Radial: Center is 0,0. Radius is 1 (covered by scale).
                // We draw a huge rectangle because the gradient might be tiled or clamp, and we want to fill the shape.
                // Android Gradient is defined inside this path.

                xml += `                <path android:pathData="M-1 -1 H 2 V 2 H -2 Z" android:fillType="nonZero">\n`;
                xml += `                    <aapt:attr name="android:fillColor">\n`;

                if (g.type === GradientType.Angular) {
                    xml += `                        <gradient android:type="sweep"\n`;
                    xml += `                                  android:centerX="0" android:centerY="0">\n`;
                } else {
                    // Radial or Diamond (mapped to radial)
                    xml += `                        <gradient android:type="radial"\n`;
                    xml += `                                  android:centerX="0" android:centerY="0"\n`;
                    xml += `                                  android:gradientRadius="1">\n`;
                }

                sortedStops.forEach(stop => {
                    xml += `                            <item android:color="${toAndroidHex(stop.color, stop.opacity)}" android:offset="${(stop.position / 100).toFixed(4)}" />\n`;
                });

                xml += `                        </gradient>\n`;
                xml += `                    </aapt:attr>\n`;
                xml += `                </path>\n`;

                xml += `            </group>\n`;
                xml += `        </group>\n`;
                xml += `    </group>\n`;

            } else {
                // --- Linear Gradient (Optimized) ---
                // For linear, we don't need groups, just start/end coordinates.
                // P_start = M * (0, 0)
                // P_end = M * (1, 0)
                let sx = 0, sy = 0, ex = 0, ey = 0;

                if (g.transform) {
                   // Linear Gradient in Figma is along the X axis of the unit square
                   const t = g.transform;
                   // (0,0) -> (tx, ty)
                   sx = t.tx;
                   sy = t.ty;
                   // (1,0) -> (tx + a, ty + b)
                   // Note: transform.a is scaleX * cos(rot), transform.b is scaleX * sin(rot)
                   // So this vector represents the primary axis
                   ex = t.tx + t.a;
                   ey = t.ty + t.b;
                } else {
                   // Fallback for legacy CSS
                   const rad = ((g.angle || 0) - 90) * Math.PI / 180;
                   const cx = (g.center?.x ?? 50) * w / 100;
                   const cy = (g.center?.y ?? 50) * h / 100;
                   const len = Math.max(w, h); // Approx
                   sx = cx - Math.cos(rad) * len;
                   sy = cy - Math.sin(rad) * len;
                   ex = cx + Math.cos(rad) * len;
                   ey = cy + Math.sin(rad) * len;
                }

                xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z">\n`;
                xml += `        <aapt:attr name="android:fillColor">\n`;
                xml += `            <gradient android:type="linear"\n`;
                xml += `                      android:startX="${sx.toFixed(2)}" android:startY="${sy.toFixed(2)}"\n`;
                xml += `                      android:endX="${ex.toFixed(2)}" android:endY="${ey.toFixed(2)}">\n`;
                sortedStops.forEach(stop => {
                    xml += `                <item android:color="${toAndroidHex(stop.color, stop.opacity)}" android:offset="${(stop.position / 100).toFixed(4)}" />\n`;
                });
                xml += `            </gradient>\n`;
                xml += `        </aapt:attr>\n`;
                xml += `    </path>\n`;
            }
        }
    });

    xml += `\n</vector>`;
    return xml;
};
