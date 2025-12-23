
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

  // 这是最外层的容器，负责“形状”和“剪切”
  const containerStyle: React.CSSProperties = {
    width: data.width,
    height: data.height,
    borderRadius: borderRadius,
    position: 'relative',
    transition: 'all 0.3s ease',
    overflow: 'hidden', // 关键：确保旋转的内容不会溢出圆角边界
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
      if (g.type === GradientType.Radial) {
        // SVG 解析出的 size.x 是相对于 width 的百分比
        // 例如 Figma 导出 r="1" scaleX="126" width="296" -> size.x = 42.5%

        let rX_px = 0;
        let scaleY = 1;

        if (g.size) {
            const widthPx = data.width;
            const heightPx = data.height;
            rX_px = (g.size.x / 100) * widthPx;
            const rY_px = (g.size.y / 100) * heightPx;

            // 防止除以0
            if (rX_px > 0) {
                scaleY = rY_px / rX_px;
            }
        } else {
             rX_px = data.width / 2;
        }

        const rotation = g.angle || 0;

        // 渲染策略：
        // 为了防止旋转时出现边缘空白，我们不将 div 设为 rX_px * 2。
        // 因为如果 rX 比较小（例如按钮中间的一个光斑），那没问题。
        // 但如果渐变很大，旋转可能会导致裁剪。
        // 关键点：CSS transform 是以自身的中心旋转的。

        // 我们创建一个 div，大小正好是渐变椭圆的长轴直径 (rX * 2)
        // 然后放置在 center 位置
        const diameter = rX_px * 2;

        const background = `radial-gradient(circle closest-side, ${stopsStr})`;

        return (
          <div key={index} style={{
            position: 'absolute',
            left: `${centerX}%`,
            top: `${centerY}%`,
            width: diameter,
            height: diameter,
            // 变换顺序：
            // 1. translate(-50%, -50%): 把 div 的中心点对齐到 (left, top)
            // 2. rotate(...): 旋转
            // 3. scale(1, scaleY): 压扁成椭圆
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(1, ${scaleY})`,
            transformOrigin: '50% 50%',
            opacity: fill.opacity ?? 1,
            mixBlendMode: (fill.blendMode || 'normal') as any,
          }}>
              <div style={{ width: '100%', height: '100%', background: background }} />
          </div>
        );
      }

      // ... (其他渐变类型保持不变) ...
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
         {/* 渲染整个按钮容器 */}
         <div style={containerStyle}>
            {/* 反转顺序渲染，因为 Figma 顶层在 fills[length-1] 还是 [0]? */}
            {/* parser.ts 中我们按顺序 push，通常 CSS 中 bg-image 越靠前越在上面。*/}
            {/* SVG 中后面的元素覆盖前面的。 */}
            {/* 我们在 parser 中如果是 SVG，按 DOM 顺序 (底 -> 顶)。 */}
            {/* 如果是 CSS，bg-image 逗号分隔，第一个在最上面。 */}
            {/* 为了统一起见，我们在 Preview 这里假设 fills 数组是 [底, ..., 顶] */}
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
