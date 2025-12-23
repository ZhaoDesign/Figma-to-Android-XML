
import { FigmaLayer, GradientType, ColorStop } from '../types';

/**
 * 鲁棒的颜色转换器：支持 #RGB, #RRGGBB, rgb(), rgba()
 */
const toAndroidHex = (color: string, opacity: number = 1): string => {
  const temp = document.createElement('div');
  temp.style.color = color;
  document.body.appendChild(temp);
  const computed = window.getComputedStyle(temp).color; // 始终返回 "rgb(r, g, b)" 或 "rgba(r, g, b, a)"
  document.body.removeChild(temp);

  const match = computed.match(/[\d.]+/g);
  if (!match) return '#FFFFFFFF';

  const r = parseInt(match[0]).toString(16).padStart(2, '0').toUpperCase();
  const g = parseInt(match[1]).toString(16).padStart(2, '0').toUpperCase();
  const b = parseInt(match[2]).toString(16).padStart(2, '0').toUpperCase();
  
  // 提取原始 alpha 并结合传入的 opacity
  const originalAlpha = match[3] ? parseFloat(match[3]) : 1;
  const finalAlpha = Math.round(originalAlpha * opacity * 255);
  const a = finalAlpha.toString(16).padStart(2, '0').toUpperCase();

  return `#${a}${r}${g}${b}`;
};

/**
 * 补全步点，确保 0% 和 100% 都有颜色值
 */
const padStops = (stops: ColorStop[]): ColorStop[] => {
  if (stops.length === 0) return [];
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const result = [...sorted];
  if (result[0].position > 0) {
    result.unshift({ ...result[0], position: 0 });
  }
  if (result[result.length - 1].position < 100) {
    result.push({ ...result[result.length - 1], position: 100 });
  }
  return result;
};

export const generateAndroidXML = (layer: FigmaLayer): string => {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n`;
  xml += `    xmlns:aapt="http://schemas.android.com/aapt"\n`;
  xml += `    android:width="${layer.width}dp" android:height="${layer.height}dp"\n`;
  xml += `    android:viewportWidth="${layer.width}" android:viewportHeight="${layer.height}">\n\n`;

  layer.fills.forEach((fill, i) => {
    if (!fill.visible || fill.type !== 'gradient') return;
    const g = fill.value as any;
    const pathData = fill.pathData || `M0,0 h${layer.width} v${layer.height} h-${layer.width} z`;
    const stops = padStops(g.stops);

    if (g.type === GradientType.Linear && g.coords) {
      xml += `    <path android:pathData="${pathData}">\n`;
      xml += `        <aapt:attr name="android:fillColor">\n`;
      xml += `            <gradient android:type="linear"\n`;
      xml += `                      android:startX="${g.coords.x1.toFixed(2)}" android:startY="${g.coords.y1.toFixed(2)}"\n`;
      xml += `                      android:endX="${g.coords.x2.toFixed(2)}" android:endY="${g.coords.y2.toFixed(2)}">\n`;
      stops.forEach((s: any) => {
        xml += `                <item android:offset="${(s.position/100).toFixed(4)}" android:color="${toAndroidHex(s.color, s.opacity)}" />\n`;
      });
      xml += `            </gradient>\n`;
      xml += `        </aapt:attr>\n`;
      xml += `    </path>\n`;
    } else if (g.type === GradientType.Radial && g.transform) {
      const t = g.transform;
      xml += `    <group android:translateX="${t.tx.toFixed(3)}" android:translateY="${t.ty.toFixed(3)}"\n`;
      xml += `           android:rotation="${t.rotation.toFixed(3)}"\n`;
      xml += `           android:scaleX="${t.scaleX.toFixed(4)}" android:scaleY="${t.scaleY.toFixed(4)}">\n`;
      // 使用足够大的路径确保渐变不被裁剪
      xml += `        <path android:pathData="M-2,-2 h4 v4 h-4 z">\n`;
      xml += `            <aapt:attr name="android:fillColor">\n`;
      xml += `                <gradient android:type="radial" android:centerX="0" android:centerY="0" android:gradientRadius="1">\n`;
      stops.forEach((s: any) => {
        xml += `                    <item android:offset="${(s.position/100).toFixed(4)}" android:color="${toAndroidHex(s.color, s.opacity)}" />\n`;
      });
      xml += `                </gradient>\n`;
      xml += `            </aapt:attr>\n`;
      xml += `        </path>\n`;
      xml += `    </group>\n`;
    }
  });

  xml += `</vector>`;
  return xml;
};
