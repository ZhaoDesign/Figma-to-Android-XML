import React from 'react';
import { FigmaLayer, Gradient, GradientType } from '../types';

interface Props {
  data: FigmaLayer;
  label?: string;
}

const renderGradient = (g: Gradient): string => {
  const stopsStr = g.stops
    .sort((a, b) => a.position - b.position)
    .map(s => `${s.color} ${s.position}%`)
    .join(', ');

  const centerX = g.center?.x ?? 50;
  const centerY = g.center?.y ?? 50;

  if (g.type === GradientType.Angular) {
      const angle = g.angle !== undefined ? `${g.angle}deg` : '0deg';
      return `conic-gradient(from ${angle} at ${centerX}% ${centerY}%, ${stopsStr})`;
  }

  if (g.type === GradientType.Diamond) {
      return `radial-gradient(ellipse at ${centerX}% ${centerY}%, ${stopsStr})`;
  }

  if (g.rawGeometry) {
    if (g.type === GradientType.Linear) return `linear-gradient(${g.rawGeometry}, ${stopsStr})`;
    return `radial-gradient(${g.rawGeometry}, ${stopsStr})`;
  }
    
  if (g.type === GradientType.Linear) return `linear-gradient(${g.angle || 180}deg, ${stopsStr})`;
  
  // Custom center for Radial
  return `radial-gradient(circle at ${centerX}% ${centerY}%, ${stopsStr})`;
};

export const PreviewCanvas: React.FC<Props> = ({ data, label }) => {
  const innerShadows = data.shadows
    .filter(s => s.visible && s.type === 'inner')
    .map(s => `inset ${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`)
    .join(', ');

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

            {[...data.fills].reverse().map((fill, index) => {
              if (!fill.visible) return null;
              const background = fill.type === 'solid' 
                ? (fill.value as string)
                : (fill.type === 'gradient' ? renderGradient(fill.value as Gradient) : `url(${fill.assetUrl})`);
              
              return (
                <div key={index} style={{
                  position: 'absolute',
                  inset: 0,
                  background: background,
                  backgroundSize: fill.type === 'noise' || fill.type === 'texture' ? 'auto' : 'cover',
                  opacity: fill.opacity ?? 1,
                  mixBlendMode: (fill.blendMode as any) || 'normal'
                }} />
              );
            })}

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