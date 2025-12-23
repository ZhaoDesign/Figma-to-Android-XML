
import React from 'react';
import { FigmaLayer, Gradient, GradientType } from '../types';

interface Props {
  data: FigmaLayer;
  label?: string;
}

export const PreviewCanvas: React.FC<Props> = ({ data, label }) => {
  const dropShadows = data.shadows
    .filter(s => s.visible && s.type === 'drop')
    .map(s => `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`)
    .join(', ');

  const borderRadius = typeof data.corners === 'number' 
    ? `${data.corners}px` 
    : `${data.corners.topLeft}px ${data.corners.topRight}px ${data.corners.bottomRight}px ${data.corners.bottomLeft}px`;

  // Container style
  const containerStyle: React.CSSProperties = {
    width: data.width,
    height: data.height,
    borderRadius: borderRadius,
    position: 'relative',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    isolation: 'isolate',
    filter: data.blur ? `blur(${data.blur}px)` : undefined,
    boxShadow: dropShadows,
  };

  const renderFill = (fill: any, index: number) => {
    if (!fill.visible) return null;

    if (fill.type === 'solid') {
      return (
        <div key={index} style={{
          position: 'absolute',
          inset: 0,
          background: fill.value,
          opacity: fill.opacity ?? 1,
          mixBlendMode: (fill.blendMode || 'normal') as any
        }} />
      );
    }

    if (fill.type === 'gradient') {
      const g = fill.value as Gradient;
      const sortedStops = [...g.stops].sort((a, b) => a.position - b.position);
      const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ');

      const isRadialLike = g.type === GradientType.Radial || g.type === GradientType.Diamond;
      const isAngular = g.type === GradientType.Angular;
      const isLinear = g.type === GradientType.Linear;

      // --- Matrix Re-projection Mode (High Fidelity) ---
      if (g.transform) {
          const t = g.transform;

          // Construct the CSS Transform Matrix: matrix(a, b, c, d, tx, ty)
          // We apply this to a 1x1 unit box.
          // Note: CSS matrix is matrix(a, b, c, d, tx, ty) corresponding to the column-major order of:
          // | a c tx |
          // | b d ty |
          // Our `decomposeMatrix` returned a,b (primary axis), c,d (secondary axis).
          // Figma/SVG Matrix:
          // | m00 m01 m02 | -> | a c tx |
          // | m10 m11 m12 | -> | b d ty |
          // So CSS matrix is exactly: matrix(t.a, t.b, t.c, t.d, t.tx, t.ty)

          const matrixCss = `matrix(${t.a}, ${t.b}, ${t.c}, ${t.d}, ${t.tx}, ${t.ty})`;

          // Gradient Definition inside the Unit Box
          // For Radial: Center 0,0 (Top Left of 1x1 box? No).
          // Figma gradient space usually defines 0,0 as origin and 1,0 as X-axis extent.
          // Radial: Center at 0,0, R=1. But CSS gradients are drawn within the box.
          // If we use a 1x1px box, top-left is 0,0.
          // We need a way to define "Center is at 0,0" for CSS.
          // `radial-gradient(circle at 0px 0px, ...)` works.

          let background = '';
          if (isAngular) {
              // Conic starts at 12 o'clock (Y-up), Figma at 3 o'clock (X-right).
              // We need to rotate -90deg (or from 90deg) to align.
              // BUT, the Matrix rotation already handles the axis direction.
              // If the matrix aligns the X-axis (0 deg), we just need the CSS gradient to start at 0deg relative to that axis.
              // CSS conic 0deg is Top. To make it Right, we add `from 90deg`.
              background = `conic-gradient(from 90deg at 0px 0px, ${stopsStr})`;
          } else if (isRadialLike) {
              // Radial: Circle at origin, radius 1px (covering the unit vector).
              background = `radial-gradient(circle 1px at 0px 0px, ${stopsStr})`;
          } else {
              // Linear: From 0,0 to 1,0.
              // `linear-gradient(to right, ...)` goes 0% to 100% of the box width.
              // Since box is 1px wide, it covers 0 to 1. Perfect.
              // However, we need to ensure it doesn't repeat if the shape is larger?
              // Actually, we usually want it to extend/clamp.
              background = `linear-gradient(to right, ${stopsStr})`;
          }

          // To cover the whole shape (which might be 300px wide), we can't just use a 1x1px div.
          // The gradient will clamp/repeat outside.
          // Better strategy:
          // Use a very large div (e.g. 2000x2000), centered at 0,0 of the transform?
          // No, the transform `matrix` includes translation `tx`.
          // So if we apply the matrix to a div at 0,0:
          // The div's local (0,0) moves to (tx, ty).
          // The gradient is drawn relative to the div's local (0,0).
          // So we need a div that extends from e.g. -1000 to +1000 relative to its own origin.
          // But `width` and `height` must be positive.

          // Solution:
          // 1. Create a div at 0,0 with 0x0 size.
          // 2. Apply matrix transform.
          // 3. Inside, use an ::after or child that is HUGE, positioned at -1000,-1000.
          // 4. BUT, the gradient must be fixed to the transformed coordinate system.

          // Even Simpler:
          // Just use a 1px x 1px div. Apply `overflow: visible`.
          // The gradient is background. Background repeats by default.
          // Use `background-size: 2000px 2000px`? No.
          // Linear: `linear-gradient` is infinite perpendicular to axis.
          // Radial: We need it to extend.

          // Let's go with the `overflow: visible` + large child approach.
          // The container applies the matrix.
          // The child provides the surface.

          // Wait, `matrix` scales the child too.
          // If we have a 1px box scaled by 100 (radius), it becomes 100px.
          // We need to fill a 300px button.
          // So we should make the box large enough to cover the button *in the local gradient space*.
          // Since local space is "unit" (approx 0-1), a box of -5 to +5 is likely enough.

          return (
             <div key={index} style={{
                 position: 'absolute',
                 left: 0, top: 0,
                 width: '1px', height: '1px', // The Anchor
                 transformOrigin: '0 0',
                 transform: matrixCss,
                 opacity: fill.opacity ?? 1,
                 mixBlendMode: (fill.blendMode || 'normal') as any,
                 pointerEvents: 'none'
             }}>
                 {/* The Surface: Large enough to cover the viewport when inversely transformed.
                     Since we don't know the inverse, we just go BIG.
                     -50 to 50 in unit space covers 50x radius. Should be enough.
                 */}
                 <div style={{
                     position: 'absolute',
                     left: '-50px', top: '-50px',
                     width: '100px', height: '100px',
                     background: background,
                     // Repeat helps fill if 50x isn't enough, but usually pad/clamp is desired.
                     // CSS Radial defaults to 'farthest-corner' if no size, but we specified `1px`.
                     // Outside that 1px circle, it's the last color (pad) if we don't say no-repeat.
                 }} />
             </div>
          );
      }

      // --- Fallback Mode (Legacy/CSS Parse) ---
      // (Keep existing fallback logic for pure CSS pastes)
      let background = '';
      if (isAngular) {
          background = `conic-gradient(from ${(g.angle||0)}deg at ${(g.center?.x??50)}% ${(g.center?.y??50)}%, ${stopsStr})`;
      } else if (isRadialLike) {
           const cx = (g.center?.x ?? 50) + '%';
           const cy = (g.center?.y ?? 50) + '%';
           // Simple radial
           background = `radial-gradient(ellipse at ${cx} ${cy}, ${stopsStr})`;
      } else {
          background = `linear-gradient(${g.angle || 0}deg, ${stopsStr})`;
      }

      return (
        <div key={index} style={{
          position: 'absolute',
          inset: 0,
          background: background,
          opacity: fill.opacity ?? 1,
          mixBlendMode: (fill.blendMode || 'normal') as any
        }} />
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-900 relative overflow-hidden border border-gray-750 rounded-xl">
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <div className="relative">
         <div style={containerStyle}>
            {data.fills.map((fill, index) => renderFill(fill, index))}
            
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <span className="text-white font-semibold mix-blend-difference text-lg select-none">
                 {label || 'Preview'}
              </span>
            </div>
         </div>
      </div>
      
      <div className="absolute bottom-4 text-xs text-gray-500 font-mono flex flex-wrap justify-center gap-x-4 gap-y-1 px-4">
        <span>Size: {Math.round(data.width)}×{Math.round(data.height)}</span>
      </div>
    </div>
  );
};
