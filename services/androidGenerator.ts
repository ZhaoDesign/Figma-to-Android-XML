
import { FigmaLayer, PrimitiveLayer } from '../types';
import { decomposeLayer } from './decomposer';

const toAndroidHex = (cssColor: string, parentOpacity: number = 1): string => {
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
  const combinedAlpha = current.a * parentOpacity;

  const toHex = (num: number) => Math.round(num).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(combinedAlpha * 255)}${toHex(current.r)}${toHex(current.g)}${toHex(current.b)}`;
};

const getRoundedRectPath = (w: number, h: number, r: number | any): string => {
    // Simplified path generator for the clip mask
    const radius = typeof r === 'number' ? r : r.topLeft;
    return `M0,0 H${w} V${h} H0 Z`; // Simplified for brevity in this context, ideally full round rect
};

export const generateAndroidXML = (layer: FigmaLayer): string => {
    // 1. Decompose Logic
    const primitives = decomposeLayer(layer);

    const w = Math.round(layer.width);
    const h = Math.round(layer.height);

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<!-- Generated via Layer Decomposition Pipeline -->\n`;
    xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n`;
    xml += `    xmlns:aapt="http://schemas.android.com/aapt"\n`;
    xml += `    android:width="${w}dp" android:height="${h}dp"\n`;
    xml += `    android:viewportWidth="${w}" android:viewportHeight="${h}">\n\n`;

    // 2. Render Primitives
    // We treat every primitive as a standard Android Group Transform operation

    primitives.forEach((p, idx) => {
        xml += `    <!-- Layer ${idx}: ${p.shape.toUpperCase()} (Merged) -->\n`;

        // Matrix Transform Group
        xml += `    <group android:translateX="${p.transform.x.toFixed(2)}" android:translateY="${p.transform.y.toFixed(2)}">\n`;
        xml += `        <group android:rotation="${p.transform.rotation.toFixed(2)}">\n`;
        xml += `            <group android:scaleX="${p.transform.scaleX.toFixed(4)}" android:scaleY="${p.transform.scaleY.toFixed(4)}">\n`;

        // Shape Geometry
        // Note: Our primitives are defined in "Unit" space (-1 to 1) or normalized space.
        // We draw a path covering that unit space.
        // For Solid rects (backgrounds), we used pixel sizes in decomposer.
        // For Gradients, we used 2x2 unit box.

        const pathData = (p.shape === 'ellipse' || p.shape === 'rect')
            ? `M-1,-1 H1 V1 H-1 Z` // Covers the transformed area
            : `M0,0 H${p.width} V${p.height} H0 Z`; // Fallback

        // Fill Logic
        if (p.fill.type === 'solid') {
             // Use simple path for solids
             const solidPath = `M-${p.width/2},-${p.height/2} H${p.width/2} V${p.height/2} H-${p.width/2} Z`;
             xml += `                <path android:pathData="${solidPath}"\n`;
             xml += `                      android:fillColor="${toAndroidHex(p.fill.color, p.fill.opacity)}" />\n`;
        } else {
             // Gradient Primitive
             const originalType = (p as any).originalType;

             xml += `                <path android:pathData="${pathData}">\n`;
             xml += `                    <aapt:attr name="android:fillColor">\n`;

             if (originalType === 'linear') {
                 // Linear mapped to unit box -1 to 1
                 // Standard linear is Left->Right
                 xml += `                        <gradient android:type="linear"\n`;
                 xml += `                                  android:startX="0" android:startY="0"\n`;
                 xml += `                                  android:endX="1" android:endY="0">\n`;
             } else if (originalType === 'angular') {
                 xml += `                        <gradient android:type="sweep"\n`;
                 xml += `                                  android:centerX="0" android:centerY="0">\n`;
             } else {
                 // Radial (Default for Ellipse/Diamond primitives)
                 xml += `                        <gradient android:type="radial"\n`;
                 xml += `                                  android:centerX="0" android:centerY="0"\n`;
                 xml += `                                  android:gradientRadius="1">\n`;
             }

             // Render Stops
             if (p.fill.stops) {
                 p.fill.stops.forEach(stop => {
                    xml += `                            <item android:color="${toAndroidHex(stop.color, stop.opacity)}" android:offset="${(stop.position / 100).toFixed(4)}" />\n`;
                 });
             }

             xml += `                        </gradient>\n`;
             xml += `                    </aapt:attr>\n`;
             xml += `                </path>\n`;
        }

        xml += `            </group>\n`;
        xml += `        </group>\n`;
        xml += `    </group>\n`;
    });

    xml += `\n</vector>`;
    return xml;
};
