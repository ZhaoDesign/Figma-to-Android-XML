
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
    xml += `<!-- Generated from Figma Advanced (Matrix Mode) -->\n`;
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

    // Global Clipping Path
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

            // Calculate absolute pixel values from percentages
            const centerX = (g.center?.x ?? 50) * w / 100;
            const centerY = (g.center?.y ?? 50) * h / 100;

            // Shared Logic for Radial, Angular, and Diamond (mapped to Radial)
            // They all benefit from the "Background Fill" + "Oversized Transformed Path" technique
            const isRadialLike = g.type === GradientType.Radial || g.type === GradientType.Diamond;
            const isAngular = g.type === GradientType.Angular;

            if (isRadialLike || isAngular) {
                const sortedStops = [...g.stops].sort((a,b) => a.position - b.position);
                const lastStop = sortedStops[sortedStops.length - 1];

                // 1. Draw Background (Fill with last stop color)
                // This prevents jagged edges at clamp boundaries
                if (lastStop) {
                    xml += `    <!-- Background Fill (Last Color) -->\n`;
                    xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z"\n`;
                    xml += `          android:fillColor="${toAndroidHex(lastStop.color, lastStop.opacity)}" />\n`;
                }

                // 2. Draw Gradient on Top
                let radiusX = (w / 2);
                let radiusY = (h / 2);

                if (g.size && g.size.x !== 0) {
                    radiusX = (g.size.x / 100) * w;
                    radiusY = (g.size.y / 100) * h;
                }

                const baseRadius = radiusX;
                const scaleY = radiusY / radiusX;
                const rotation = g.angle || 0;

                // Adjust rotation for Angular (Figma starts at 12 o'clock/90deg?, Android Sweep starts at 3 o'clock/0deg)
                // Figma Angular often comes with a transform that handles this.
                // If it's a standard CSS parse, `conic-gradient(from 90deg)` means start at 12.
                // Android `sweep` starts at 3. So 90deg offset might be needed if not handled by matrix.
                // However, `data-figma-gradient-fill` matrix usually handles it.
                // For `Diamond`, we map to `radial` as Android has no Diamond support.

                xml += `    <group android:translateX="${centerX.toFixed(2)}" android:translateY="${centerY.toFixed(2)}">\n`;
                xml += `        <group android:rotation="${rotation.toFixed(2)}">\n`;
                xml += `            <group android:scaleY="${scaleY.toFixed(6)}">\n`;

                const drawSize = Math.max(w, h) * 4;

                xml += `                <path android:pathData="M${(-drawSize).toFixed(1)},${(-drawSize).toFixed(1)} h${(drawSize * 2).toFixed(1)} v${(drawSize * 2).toFixed(1)} h-${(drawSize * 2).toFixed(1)} z">\n`;
                xml += `                    <aapt:attr name="android:fillColor">\n`;

                if (isAngular) {
                    xml += `                        <gradient android:type="sweep"\n`;
                    xml += `                                  android:centerX="0" android:centerY="0">\n`;
                } else {
                    // Radial (and Diamond fallback)
                    xml += `                        <gradient android:type="radial"\n`;
                    xml += `                                  android:centerX="0" android:centerY="0"\n`;
                    xml += `                                  android:gradientRadius="${baseRadius.toFixed(2)}">\n`;
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
                // --- LINEAR GRADIENT ---
                xml += `    <path android:pathData="M0,0 h${w} v${h} h-${w} z">\n`;
                xml += `        <aapt:attr name="android:fillColor">\n`;
                xml += `            <gradient android:type="linear"\n`;

                let startX, startY, endX, endY;

                if (g.handles) {
                    startX = g.handles.start.x;
                    startY = g.handles.start.y;
                    endX = g.handles.end.x;
                    endY = g.handles.end.y;
                } else {
                    const rad = ((g.angle || 0) - 90) * Math.PI / 180;
                    const length = Math.sqrt(w*w + h*h) * 2;
                    startX = centerX - (Math.cos(rad) * length / 2);
                    startY = centerY - (Math.sin(rad) * length / 2);
                    endX = centerX + (Math.cos(rad) * length / 2);
                    endY = centerY + (Math.sin(rad) * length / 2);
                }

                xml += `                      android:startX="${startX.toFixed(2)}" android:startY="${startY.toFixed(2)}"\n`;
                xml += `                      android:endX="${endX.toFixed(2)}" android:endY="${endY.toFixed(2)}">\n`;
                g.stops.sort((a,b) => a.position - b.position).forEach(stop => {
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
