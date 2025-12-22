
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
          mixBlendMode: fill.blendMode || 'normal'
        }} />
      );
    }

    if (fill.type === 'gradient') {
      const g = fill.value as Gradient;
      const stopsStr = g.stops
        .sort((a, b) => a.position - b.position)
        .map(s => `${s.color} ${s.position}%`)
        .join(', ');

      const centerX = g.center?.x ?? 50;
      const centerY = g.center?.y ?? 50;

      const isElliptical = g.type === GradientType.Angular || g.type === GradientType.Radial;
      
      if (isElliptical) {
        // ELLIPTICAL MATRIX TRANSFORM
        // We calculate scale factors based on the parsed CSS 'size' percentages.
        // If not explicit, we fallback to layer aspect ratio.
        const layerAspect = data.height / data.width;
        
        let scaleX = 1;
        let scaleY = 1;
        
        if (g.size) {
            // In CSS radial-gradient(width height at x y), width and height are 2*radius.
            // But we scale a unit square, so we just care about the RATIO.
            const ratio = (g.size.y / g.size.x) * layerAspect;
            scaleY = ratio;
        } else {
            scaleY = layerAspect;
        }

        const size = Math.max(data.width, data.height) * 4; // High overflow to prevent clipping during transforms
        const angle = g.angle !== undefined ? `${g.angle}deg` : '0deg';
        
        const background = g.type === GradientType.Angular
          ? `conic-gradient(from ${angle} at 50% 50%, ${stopsStr})`
          : `radial-gradient(circle at 50% 50%, ${stopsStr})`;

        return (
          <div key={index} style={{
            position: 'absolute',
            left: `${centerX}%`,
            top: `${centerY}%`,
            width: size,
            height: size,
            background: background,
            // Centering the unit square then applying the non-uniform scale
            transform: `translate(-50%, -50%) scaleX(${scaleX}) scaleY(${scaleY})`,
            opacity: fill.opacity ?? 1,
            mixBlendMode: fill.blendMode || 'normal',
            pointerEvents: 'none'
          }} />
        );
      }

      // Linear Gradient (standard)
      const background = `linear-gradient(${g.angle || 180}deg, ${stopsStr})`;
      return (
        <div key={index} style={{
          position: 'absolute',
          inset: 0,
          background: background,
          opacity: fill.opacity ?? 1,
          mixBlendMode: fill.blendMode || 'normal'
        }} />
      );
    }

    return null;
  };

  const innerShadows = data.shadows
    .filter(s => s.visible && s.type === 'inner')
    .map(s => `inset ${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`)
    .join(', ');

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-900 relative overflow-hidden border border-gray-750 rounded-xl">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>
      
      <div className="relative">
         <div style={containerStyle}>
            {data.backdropBlur ? (
              <div style={{
                position: 'absolute',
                inset: 0,
                backdropFilter: `blur(${data.backdropBlur}px)`,
                WebkitBackdropFilter: `blur(${data.backdropBlur}px)`,
                zIndex: -1
              }} />
            ) : null}

            {[...data.fills].reverse().map((fill, index) => renderFill(fill, index))}

            {innerShadows && (
              <div style={{
                  position: 'absolute',
                  inset: 0,
                  boxShadow: innerShadows,
                  borderRadius: borderRadius,
                  pointerEvents: 'none',
                  zIndex: 10
              }} />
            )}
            
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <span className="text-white font-semibold mix-blend-difference text-lg select-none">
                 {label || 'Preview'}
              </span>
            </div>
         </div>
      </div>
      
      <div className="absolute bottom-4 text-xs text-gray-500 font-mono flex flex-wrap justify-center gap-x-4 gap-y-1 px-4">
        <span>Size: {Math.round(data.width)}×{Math.round(data.height)}</span>
        {data.backdropBlur ? <span className="text-blue-400">Backdrop Blur: {data.backdropBlur}px</span> : null}
      </div>
    </div>
  );
};
