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
    
  if (g.type === GradientType.Linear) {
    return `linear-gradient(${g.angle || 180}deg, ${stopsStr})`;
  } else {
    return `radial-gradient(circle at 50% 50%, ${stopsStr})`;
  }
};

export const PreviewCanvas: React.FC<Props> = ({ data, label }) => {
  // Construct CSS styles from data
  
  // 1. Backgrounds
  const backgrounds = data.fills
    .filter(f => f.visible)
    .map(f => {
      if (f.type === 'solid') return f.value as string;
      return renderGradient(f.value as Gradient);
    })
    .join(', ');

  // 2. Shadows
  const boxShadows = data.shadows
    .filter(s => s.visible)
    .map(s => {
      const inset = s.type === 'inner' ? 'inset ' : '';
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    })
    .join(', ');

  // 3. Corners
  let borderRadius = '';
  if (typeof data.corners === 'number') {
    borderRadius = `${data.corners}px`;
  } else {
    borderRadius = `${data.corners.topLeft}px ${data.corners.topRight}px ${data.corners.bottomRight}px ${data.corners.bottomLeft}px`;
  }

  const style: React.CSSProperties = {
    width: data.width,
    height: data.height,
    background: backgrounds,
    boxShadow: boxShadows,
    borderRadius: borderRadius,
    position: 'relative',
    transition: 'all 0.3s ease',
  };

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-gray-950 relative overflow-hidden border border-gray-750 rounded-xl">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>
      
      <div style={style} className="flex items-center justify-center">
         <span className="text-white font-medium mix-blend-overlay text-lg select-none">
            {label || 'Preview'}
         </span>
      </div>
      
      <div className="absolute bottom-4 text-xs text-gray-500 font-mono">
        {Math.round(data.width)} x {Math.round(data.height)}
      </div>
    </div>
  );
};
