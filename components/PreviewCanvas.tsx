
import React, { useMemo } from 'react';
import { FigmaLayer } from '../types';
import { decomposeLayer } from '../services/decomposer';

interface Props {
  data: FigmaLayer;
  label?: string;
}

export const PreviewCanvas: React.FC<Props> = ({ data, label }) => {
  // 1. Use the Decomposer Algorithm to get the Layer Graph
  const primitives = useMemo(() => decomposeLayer(data), [data]);

  const dropShadows = data.shadows
    .filter(s => s.visible && s.type === 'drop')
    .map(s => `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`)
    .join(', ');

  const borderRadius = typeof data.corners === 'number'
    ? `${data.corners}px`
    : `${data.corners.topLeft}px ${data.corners.topRight}px ${data.corners.bottomRight}px ${data.corners.bottomLeft}px`;

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-900 relative overflow-hidden border border-gray-750 rounded-xl">
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      {/* The Canvas */}
      <div style={{
          width: data.width,
          height: data.height,
          borderRadius: borderRadius,
          position: 'relative',
          overflow: 'hidden', // Masking
          isolation: 'isolate',
          boxShadow: dropShadows,
          background: 'transparent'
      }}>
          {/* 2. Render Primitives exactly as Android will see them */}
          {primitives.map(p => {
              const t = p.transform;
              // CSS Matrix: matrix(scaleX, skewY, skewX, scaleY, tx, ty)
              // We decompose scale/rotate separately in our logic, so we reconstruct for CSS
              // But our 'transform' object has rotation (deg) and scaleX/Y.
              // We can chain CSS transforms which is easier than matrix math here.
              // Note: Order matters. Translate -> Rotate -> Scale.

              const transformCss = `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${t.scaleX}, ${t.scaleY})`;

              const originalType = (p as any).originalType;
              let background = '';

              if (p.fill.type === 'solid') {
                  background = p.fill.color;
              } else {
                  const stops = p.fill.stops?.map(s => `${s.color} ${s.position}%`).join(', ') || '';
                  if (originalType === 'linear') {
                      background = `linear-gradient(to right, ${stops})`;
                  } else if (originalType === 'angular') {
                      // Note: Angular 0deg in CSS is Top, in standard math it's Right.
                      // Our matrix usually handles this, but Conic needs 'from' adjustment sometimes.
                      // For primitive rendering, we align to the box's X axis.
                      background = `conic-gradient(from 90deg at 50% 50%, ${stops})`;
                  } else {
                      // Radial / Diamond (Rendered as Radial on Primitive)
                      // Important: The primitive is -1 to 1. Center is 50%.
                      background = `radial-gradient(circle at 50% 50%, ${stops})`;
                  }
              }

              // Geometry
              // Primitives are usually Unit Boxes (-1 to 1) scaled up.
              // In CSS, we render a div of size 2x2 px, and scale it?
              // Or size 100x100 and scale by 0.01?
              // Let's use 2px x 2px box as the "Unit", so scale=100 means 200px.
              // Actually, simpler: Render a 2px box anchored at center.

              const isUnitShape = (p.fill.type !== 'solid'); // Solids used full pixel size in decomposer
              const baseSize = isUnitShape ? 2 : 1;
              // If solid, w/h are pixel sizes. If gradient, w/h are 2 (unit).

              return (
                  <div key={p.id} style={{
                      position: 'absolute',
                      left: 0, top: 0,
                      width: p.width + 'px',
                      height: p.height + 'px',
                      transformOrigin: '0 0', // We are translating top-left to 't.x, t.y' which is usually center?
                      // Wait, our Decomposer matrix 'tx/ty' is usually the CENTER of the shape for gradients.
                      // But CSS transform origin defaults to center of the element.
                      // If we position at 0,0 and translate to cx,cy, we need to offset by w/2, h/2?
                      // Let's assume t.x/t.y is the geometric center.
                      // We place the div such that its center is at 0,0, then apply transform.
                      marginLeft: -p.width/2 + 'px',
                      marginTop: -p.height/2 + 'px',
                      transform: transformCss,
                      background: background,
                      opacity: p.fill.opacity,
                      borderRadius: (p.shape === 'ellipse' || originalType === 'radial' || originalType === 'angular') ? '50%' : '0%',
                  }} />
              );
          })}

          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <span className="text-white font-semibold mix-blend-difference text-lg select-none">
                 {label || 'Preview'}
              </span>
            </div>
      </div>

      <div className="absolute bottom-4 text-xs text-gray-500 font-mono">
        Layer Graph: {primitives.length} Primitives
      </div>
    </div>
  );
};
