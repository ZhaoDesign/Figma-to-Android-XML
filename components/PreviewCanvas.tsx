
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
          mixBlendMode: (fill.blendMode || 'normal') as any
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
        let scaleY = data.height / data.width;
        let baseRadiusPx = data.width / 2;

        if (g.type === GradientType.Radial && g.size && g.size.x !== 0) {
           const horizRadius = (g.size.x / 100) * data.width;
           const vertRadius = (g.size.y / 100) * data.height;
           baseRadiusPx = horizRadius;
           scaleY = vertRadius / horizRadius;
        } else if (g.type === GradientType.Angular && g.size && g.size.x !== 0) {
           scaleY = (g.size.y / g.size.x) * (data.height / data.width);
        }

        const size = baseRadiusPx * 12; // Buffer for coverage
        const angle = g.angle !== undefined ? g.angle : 0;
        
        const background = g.type === GradientType.Angular
          ? `conic-gradient(from 0deg at 50% 50%, ${stopsStr})`
          : `radial-gradient(circle at 50% 50%, ${stopsStr})`;

        return (
          <div key={index} 
            style={{
              position: 'absolute',
              left: `${centerX}%`,
              top: `${centerY}%`,
              width: size,
              height: size,
              pointerEvents: 'none',
              transform: `translate(-50%, -50%) scale(1, ${scaleY})`,
              opacity: fill.opacity ?? 1,
              mixBlendMode: (fill.blendMode || 'normal') as any,
              transformOrigin: '50% 50%'
            }}
          >
            <div style={{
                width: '100%',
                height: '100%',
                background: background,
                // Nested rotation ONLY for Angular/Conic to preserve correct elliptical sweep
                transform: g.type === GradientType.Angular ? `rotate(${angle}deg)` : 'none',
                transformOrigin: '50% 50%'
            }} />
          </div>
        );
      }

      const background = `linear-gradient(${g.angle || 0}deg, ${stopsStr})`;
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
            {[...data.fills].reverse().map((fill, index) => renderFill(fill, index))}
            
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
