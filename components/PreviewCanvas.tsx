
import React from 'react';
import { FigmaLayer, GradientType } from '../types';

export const PreviewCanvas: React.FC<{ data: FigmaLayer; label?: string }> = ({ data }) => {
  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-950 border border-gray-750 rounded-xl p-8">
      <svg 
        width={data.width} 
        height={data.height} 
        viewBox={`0 0 ${data.width} ${data.height}`}
        style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}
      >
        <defs>
          {data.fills.map((fill, i) => {
            if (fill.type !== 'gradient') return null;
            const g = fill.value as any;
            const id = `preview_grad_${i}`;
            
            if (g.type === GradientType.Radial) {
              const t = g.transform;
              if (!t) return null;
              return (
                <radialGradient 
                  key={id} id={id} cx="0" cy="0" r="1" 
                  gradientUnits="userSpaceOnUse"
                  gradientTransform={`matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.tx} ${t.ty})`}
                >
                  {g.stops.map((s: any, si: number) => (
                    <stop 
                      key={si} 
                      offset={`${s.position}%`} 
                      stopColor={s.color} 
                      stopOpacity={s.opacity !== undefined ? s.opacity : 1} 
                    />
                  ))}
                </radialGradient>
              );
            } else {
              const c = g.coords;
              if (!c) return null;
              return (
                <linearGradient 
                  key={id} id={id} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} 
                  gradientUnits="userSpaceOnUse"
                >
                  {g.stops.map((s: any, si: number) => (
                    <stop 
                      key={si} 
                      offset={`${s.position}%`} 
                      stopColor={s.color} 
                      stopOpacity={s.opacity !== undefined ? s.opacity : 1} 
                    />
                  ))}
                </linearGradient>
              );
            }
          })}
        </defs>
        {data.fills.map((fill, i) => (
          <path 
            key={i} 
            d={fill.pathData || `M0 0h${data.width}v${data.height}H0z`} 
            fill={`url(#preview_grad_${i})`}
            // 默认使用 normal，除非有特殊需要。
            // i > 0 && i < data.fills.length && fill.pathData === data.fills[0].pathData ? 'screen' : 'normal'
            // 根据 SVG 标准，这里应该使用普通叠加模式
            style={{ mixBlendMode: 'normal' }} 
          />
        ))}
      </svg>
    </div>
  );
};
