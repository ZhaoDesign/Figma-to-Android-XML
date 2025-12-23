
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

      const stopsStr = sortedStops
        .map(s => `${s.color} ${s.position}%`)
        .join(', ');

      // Use Pixel values derived from parser
      const centerX_px = (g.center?.x ?? 50) * data.width / 100;
      const centerY_px = (g.center?.y ?? 50) * data.height / 100;

      // --- Radial Gradient ---
      if (g.type === GradientType.Radial) {

        let rX_px = data.width / 2;
        let scaleY = 1;

        if (g.size) {
            rX_px = (g.size.x / 100) * data.width;
            const rY_px = (g.size.y / 100) * data.height;
            if (rX_px > 0) {
                scaleY = rY_px / rX_px;
            }
        }

        const rotation = g.angle || 0;
        const extendSize = Math.max(data.width, data.height) * 4;
        const background = `radial-gradient(circle ${rX_px.toFixed(2)}px at center, ${stopsStr})`;

        // Get the last color for the background fill
        const lastColor = sortedStops.length > 0 ? sortedStops[sortedStops.length - 1].color : 'transparent';

        return (
          <React.Fragment key={index}>
            {/* 1. Background Fill Layer (Last Color) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: lastColor,
                opacity: fill.opacity ?? 1,
            }} />

            {/* 2. Radial Gradient Layer */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: extendSize,
              height: extendSize,
              transform: `translate3d(${centerX_px}px, ${centerY_px}px, 0) translate3d(-50%, -50%, 0) rotate(${rotation}deg) scale(1, ${scaleY})`,
              transformOrigin: '50% 50%',
              opacity: fill.opacity ?? 1,
              mixBlendMode: (fill.blendMode || 'normal') as any,
            }}>
                <div style={{ width: '100%', height: '100%', background: background }} />
            </div>
          </React.Fragment>
        );
      }

      // --- Angular Gradient ---
      if (g.type === GradientType.Angular) {
        let scaleY = (data.height / data.width);
        if (g.size && g.size.x !== 0) {
           scaleY = (g.size.y / g.size.x) * (data.height / data.width);
        }
        const angle = g.angle !== undefined ? g.angle : 0;
        const size = Math.max(data.width, data.height) * 4;

        return (
          <div key={index}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: size,
              height: size,
              pointerEvents: 'none',
              transform: `translate3d(${centerX_px}px, ${centerY_px}px, 0) translate3d(-50%, -50%, 0) scale(1, ${scaleY})`,
              opacity: fill.opacity ?? 1,
              mixBlendMode: (fill.blendMode || 'normal') as any,
              transformOrigin: '50% 50%'
            }}
          >
            <div style={{
                width: '100%',
                height: '100%',
                background: `conic-gradient(from 0deg at 50% 50%, ${stopsStr})`,
                transform: `rotate(${angle}deg)`,
                transformOrigin: '50% 50%'
            }} />
          </div>
        );
      }

      // Linear Gradient
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
