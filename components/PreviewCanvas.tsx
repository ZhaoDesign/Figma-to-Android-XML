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

  if (g.rawGeometry) {
    if (g.type === GradientType.Linear) return `linear-gradient(${g.rawGeometry}, ${stopsStr})`;
    return `radial-gradient(${g.rawGeometry}, ${stopsStr})`;
  }
    
  if (g.type === GradientType.Linear) return `linear-gradient(${g.angle || 180}deg, ${stopsStr})`;
  return `radial-gradient(circle at 50% 50%, ${stopsStr})`;
};

export const PreviewCanvas: React.FC<Props> = ({ data, label }) => {
  // 1. Shadows (Drop and Inner)
  const boxShadows = data.shadows
    .filter(s => s.visible)
    .map(s => {
      const inset = s.type === 'inner' ? 'inset ' : '';
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    })
    .join(', ');

  // 2. Corners
  const borderRadius = typeof data.corners === 'number' 
    ? `${data.corners}px` 
    : `${data.corners.topLeft}px ${data.corners.topRight}px ${data.corners.bottomRight}px ${data.corners.bottomLeft}px`;

  // 3. Main Container Styles
  const containerStyle: React.CSSProperties = {
    width: data.width,
    height: data.height,
    borderRadius: borderRadius,
    position: 'relative',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    isolation: 'isolate',
    filter: data.blur ? `blur(${data.blur}px)` : undefined,
    backdropFilter: data.backdropBlur ? `blur(${data.backdropBlur}px)` : undefined,
    WebkitBackdropFilter: data.backdropBlur ? `blur(${data.backdropBlur}px)` : undefined,
  };

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-gray-950 relative overflow-hidden border border-gray-750 rounded-xl">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>
      
      {/* Container with Box Shadows on a wrapper to ensure they aren't clipped by overflow:hidden if they are drop shadows */}
      <div style={{ filter: boxShadows.includes('inset') ? undefined : `drop-shadow(0 0 0 transparent)` }}>
         <div style={containerStyle}>
            {/* Fills Layer */}
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

            {/* Inner Shadows Layer (needs to be on top of fills to be visible) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                boxShadow: boxShadows,
                borderRadius: borderRadius,
                pointerEvents: 'none',
                zIndex: 5
            }} />
            
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="text-white font-medium mix-blend-overlay text-lg select-none drop-shadow-md">
                 {label || 'Preview'}
              </span>
            </div>
         </div>
      </div>
      
      <div className="absolute bottom-4 text-xs text-gray-500 font-mono flex gap-4">
        <span>{Math.round(data.width)} x {Math.round(data.height)}</span>
        {data.backdropBlur ? <span className="text-blue-400">Backdrop Blur: {data.backdropBlur}px</span> : null}
      </div>
    </div>
  );
};
