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

  // If we captured the raw CSS geometry (e.g. "50% 50% at 50% 50%" or "180deg"), use it directly.
  // This ensures the preview looks EXACTLY like Figma, even if the user dragged handles way outside the box.
  if (g.rawGeometry) {
    if (g.type === GradientType.Linear) {
      return `linear-gradient(${g.rawGeometry}, ${stopsStr})`;
    } else {
      return `radial-gradient(${g.rawGeometry}, ${stopsStr})`;
    }
  }
    
  // Fallback defaults if parsing missed the geometry
  if (g.type === GradientType.Linear) {
    return `linear-gradient(${g.angle || 180}deg, ${stopsStr})`;
  } else {
    return `radial-gradient(circle at 50% 50%, ${stopsStr})`;
  }
};

export const PreviewCanvas: React.FC<Props> = ({ data, label }) => {
  // 1. Shadows
  const boxShadows = data.shadows
    .filter(s => s.visible)
    .map(s => {
      const inset = s.type === 'inner' ? 'inset ' : '';
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    })
    .join(', ');

  // 2. Corners
  let borderRadius = '';
  if (typeof data.corners === 'number') {
    borderRadius = `${data.corners}px`;
  } else {
    borderRadius = `${data.corners.topLeft}px ${data.corners.topRight}px ${data.corners.bottomRight}px ${data.corners.bottomLeft}px`;
  }

  // 3. Dimensions & Base Style
  const containerStyle: React.CSSProperties = {
    width: data.width,
    height: data.height,
    boxShadow: boxShadows,
    borderRadius: borderRadius,
    position: 'relative',
    transition: 'all 0.3s ease',
    overflow: 'hidden', // Clip children to corners
    isolation: 'isolate', // Create stacking context
  };

  // 4. Layers (Fills)
  // Figma/CSS 'fills' array is Top-to-Bottom (Index 0 is Top).
  // DOM Stacking is Bottom-to-Top (Last child is Top).
  // So we render fills.reverse().
  // HOWEVER: We want Index 0 (Top) to be rendered LAST (on top).
  // So we iterate data.fills.slice().reverse().
  const layers = [...data.fills].reverse().map((fill, index) => {
    if (!fill.visible) return null;

    const background = fill.type === 'solid' 
      ? (fill.value as string)
      : renderGradient(fill.value as Gradient);

    return (
      <div
        key={index}
        style={{
          position: 'absolute',
          inset: 0,
          background: background,
        }}
      />
    );
  });

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-gray-950 relative overflow-hidden border border-gray-750 rounded-xl">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>
      
      {/* The Component Preview */}
      <div style={containerStyle}>
        {layers}
        
        {/* Label Overlay (Centered) */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-white font-medium mix-blend-overlay text-lg select-none drop-shadow-md">
             {label || 'Preview'}
          </span>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-xs text-gray-500 font-mono">
        {Math.round(data.width)} x {Math.round(data.height)}
      </div>
    </div>
  );
};
