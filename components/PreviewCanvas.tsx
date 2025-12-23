
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

      // --- 径向渐变 (Radial) ---
      // 模拟 Android 渲染逻辑：创建一个圆，缩放其 Y 轴变成椭圆，然后旋转整个椭圆
      if (g.type === GradientType.Radial) {
        // 1. 计算长短轴
        let radiusX = 50; // default %
        let radiusY = 50;

        if (g.size) {
            radiusX = g.size.x; // e.g. 42.57%
            radiusY = g.size.y; // e.g. 100%
        }

        // 2. 计算缩放比例 (ScaleY)
        // 注意：这里需要考虑容器的实际宽高比，因为 g.size 是百分比
        // 在 Android 代码中：baseRadius = radiusX_px, scaleY = radiusY_px / radiusX_px
        // 在 CSS transform scale 中，我们也是相对自身坐标系
        // 但 CSS radial-gradient(circle) 生成正圆，我们需要压缩它

        // 计算实际像素比例
        const widthPx = data.width;
        const heightPx = data.height;
        const rX_px = (radiusX / 100) * widthPx;
        const rY_px = (radiusY / 100) * heightPx;

        const scaleY = rX_px === 0 ? 1 : rY_px / rX_px;
        const rotation = g.angle || 0;

        // 使用一个超大的正方形容器来承载渐变，确保旋转后能覆盖
        // 大小设为 200% 或更大
        const bigSize = '200%';

        // 背景是一个正圆渐变，半径为 rX_px (即100%宽度的 circle)
        // 我们通过 transform scale(1, scaleY) 把它压扁
        const background = `radial-gradient(circle closest-side, ${stopsStr})`;

        return (
          <div key={index} style={{
            position: 'absolute',
            left: `${centerX}%`,
            top: `${centerY}%`,
            width: rX_px * 2, // 宽度设为直径
            height: rX_px * 2, // 高度也设为直径（正圆）
            // 变换顺序：先平移居中 -> 旋转 -> 缩放
            // 这里的顺序和 Android XML 的嵌套对应：
            // Android Outer Group: Rotation
            // Android Inner Group: ScaleY
            // CSS: transform 属性从右向左执行（但写在字符串里是从左向右读？不，是矩阵乘法）
            // 简单的理解：我们对这个 div 应用样式。
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(1, ${scaleY})`,
            transformOrigin: '50% 50%',
            opacity: fill.opacity ?? 1,
            mixBlendMode: (fill.blendMode || 'normal') as any,
          }}>
              <div style={{ width: '100%', height: '100%', background: background }} />
          </div>
        );
      }

      // --- 角度渐变 (Angular) ---
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
                background: `conic-gradient(from 0deg at 50% 50%, ${stopsStr})`,
                transform: `rotate(${angle}deg)`,
                transformOrigin: '50% 50%'
            }} />
          </div>
        );
      }

      // 线性渐变 (Linear)
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
