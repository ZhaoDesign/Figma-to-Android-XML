
import React from 'react';
import { FigmaLayer, Gradient, GradientType } from '../types';

interface Props {
  data: FigmaLayer;
  label?: string;
}

/**
 * PreviewCanvas component renders a visual representation of the Figma layer
 * using CSS properties.
 */
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

  // Helper to render individual fill layers
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

      let background = '';
      if (g.type === GradientType.Linear) {
        background = `linear-gradient(${g.angle || 0}deg, ${stopsStr})`;
      } else if (g.type === GradientType.Radial) {
        // CSS radial-gradient supports elliptical shapes
        const sizeX = g.size?.x ?? 50;
        const sizeY = g.size?.y ?? 50;
        background = `radial-gradient(${sizeX}% ${sizeY}% at ${centerX}% ${centerY}%, ${stopsStr})`;
      } else if (g.type === GradientType.Angular) {
        // Conic gradient for angular/sweep
        background = `conic-gradient(from ${(g.angle || 0)}deg at ${centerX}% ${centerY}%, ${stopsStr})`;
      } else if (g.type === GradientType.Diamond) {
        // Approximating diamond with a sharp radial gradient for preview
        background = `radial-gradient(circle at ${centerX}% ${centerY}%, ${stopsStr})`;
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

  // Ensure the component returns a ReactNode to fix the "Type 'void' is not assignable to type 'ReactNode'" error
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-900/50 rounded-2xl border border-dashed border-gray-700 min-h-[400px]">
      <div style={containerStyle}>
        {data.fills.map((fill, i) => renderFill(fill, i))}
        {label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-white/10 font-bold text-3xl uppercase tracking-widest">{label}</span>
          </div>
        )}
      </div>
    </div>
  );
};
