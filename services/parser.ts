
import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Shadow, Corners } from '../types';

const pxToNum = (val: string): number => {
  if (!val) return 0;
  const clean = val.trim().replace('px', '');
  return parseFloat(clean) || 0;
};

const splitCSSLayers = (cssValue: string): string[] => {
  if (!cssValue) return [];
  const layers: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < cssValue.length; i++) {
    const char = cssValue[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
};

const parseGradient = (gradientStr: string): Gradient | null => {
  const lowerStr = gradientStr.toLowerCase();
  const isLinear = lowerStr.includes('linear-gradient');
  const isRadial = lowerStr.includes('radial-gradient');
  const isConic = lowerStr.includes('conic-gradient');
  
  if (!isLinear && !isRadial && !isConic) return null;

  const firstParen = gradientStr.indexOf('(');
  const lastParen = gradientStr.lastIndexOf(')');
  if (firstParen === -1 || lastParen === -1) return null;

  const content = gradientStr.substring(firstParen + 1, lastParen);
  const parts = splitCSSLayers(content);
  
  let type = isLinear ? GradientType.Linear : (isRadial ? GradientType.Radial : GradientType.Angular);
  let angle = 0;
  let stopsStartIndex = 0;
  let center = { x: 50, y: 50 };
  let size = { x: 50, y: 50 }; // Default radii percentages (standard CSS radial is 50% 50%)

  const firstPart = parts[0].trim();
  const firstPartLower = firstPart.toLowerCase();

  if (isConic) {
      const fromMatch = firstPartLower.match(/from\s+([\d.]+)deg/);
      if (fromMatch) angle = parseFloat(fromMatch[1]);
      const atMatch = firstPartLower.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) center = { x: parseFloat(atMatch[1]), y: parseFloat(atMatch[2]) };
      stopsStartIndex = 1;
  } else if (isLinear) {
      const degMatch = firstPartLower.match(/([\d.]+)deg/);
      if (degMatch) {
          angle = parseFloat(degMatch[1]);
          stopsStartIndex = 1;
      }
  } else if (isRadial) {
      // 修复逻辑：更稳健地解析 Figma 的径向渐变语法
      // 常见格式: "48.14% 50% at 50% 50%" 或 "at 50% 50%"

      // 只要包含 " at "，我们就认为第一部分是参数定义，而不是颜色
      if (firstPartLower.includes(' at ') || firstPartLower.startsWith('at ')) {
          stopsStartIndex = 1;

          // 分割尺寸和位置
          // 格式: [size part] at [position part]
          const atIndex = firstPartLower.indexOf('at');
          const sizeStr = firstPartLower.substring(0, atIndex).trim();
          const posStr = firstPartLower.substring(atIndex + 2).trim(); // +2 for length of "at"

          // 提取尺寸 (例如: "48.14% 50%")
          const sizeMatches = sizeStr.match(/([\d.]+)%/g);
          if (sizeMatches && sizeMatches.length >= 2) {
             // 移除 % 后转数字
             size = {
                 x: parseFloat(sizeMatches[0]),
                 y: parseFloat(sizeMatches[1])
             };
          } else if (sizeMatches && sizeMatches.length === 1) {
             // 只有一个值，则通常用于圆形，宽高一致
             const val = parseFloat(sizeMatches[0]);
             size = { x: val, y: val };
          }

          // 提取位置 (例如: "50% 50%")
          const posMatches = posStr.match(/([\d.]+)%/g);
          if (posMatches && posMatches.length >= 2) {
              center = {
                  x: parseFloat(posMatches[0]),
                  y: parseFloat(posMatches[1])
              };
          }
      } else {
          // 尝试匹配没有 "at" 但开头是百分比的情况 (罕见，但为了保险)
          const pureSizeMatch = firstPartLower.match(/^([\d.]+)%\s+([\d.]+)%$/);
          if (pureSizeMatch) {
             stopsStartIndex = 1;
             size = { x: parseFloat(pureSizeMatch[1]), y: parseFloat(pureSizeMatch[2]) };
          }
      }
  }

  const stops: ColorStop[] = [];
  const rawStops = parts.slice(stopsStartIndex);

  rawStops.forEach((part, index) => {
    // Regex to capture color and optional position
    // 允许颜色值中包含括号 (例如 rgba)
    const match = part.trim().match(/^([\s\S]+?)(?:\s+(-?[\d.]+(?:%|px|deg|))|)$/);
    if (match) {
      let colorStr = match[1].trim();
      let posVal = match[2];
      let position = 0;

      // 过滤掉因为解析错误导致的非颜色字符串
      if (colorStr.includes(' at ') || colorStr.length > 50) {
          return;
      }

      if (posVal) {
          position = parseFloat(posVal);
      } else {
          position = rawStops.length > 1 ? (index / (rawStops.length - 1)) * 100 : 0;
      }
      stops.push({ color: colorStr, position });
    }
  });

  return { type, angle, center, size, stops };
};

export const parseClipboardData = (text: string): FigmaLayer | null => {
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  const cleanText = text.replace(/[{}]/g, '').replace(/\n/g, ' ');
  tempDiv.setAttribute('style', cleanText);
  const style = tempDiv.style;

  const width = pxToNum(style.width) || 200;
  const height = pxToNum(style.height) || 60;

  const radiusStr = style.borderRadius || '0px';
  const radii = radiusStr.split(/\s+/).map(pxToNum);
  let corners: number | Corners = radii[0] || 0;
  if (radii.length === 4) corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[2], bottomLeft: radii[3] };

  const fills: Fill[] = [];
  const bgImage = style.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const layers = splitCSSLayers(bgImage);
    layers.forEach((layer) => {
      const gradient = parseGradient(layer);
      if (gradient) {
        fills.push({ type: 'gradient', value: gradient, visible: true, blendMode: 'normal' });
      }
    });
  }
  
  const bgColor = style.backgroundColor;
  if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
    fills.push({ type: 'solid', value: bgColor, visible: true });
  }

  const shadows: Shadow[] = [];
  const boxShadow = style.boxShadow;
  if (boxShadow && boxShadow !== 'none') {
    splitCSSLayers(boxShadow).forEach(layer => {
      const isInner = layer.includes('inset');
      const colorMatch = layer.match(/(rgba?\(.*?\)|hsla?\(.*?\)|#[\da-fA-F]+|[a-z]+)/i);
      const color = colorMatch ? colorMatch[0] : '#000000';
      const cleanLayer = layer.replace('inset', '').replace(color, '').trim();
      const nums = cleanLayer.split(/\s+/).filter(v => v !== '').map(pxToNum);
      
      shadows.push({ 
        type: isInner ? 'inner' : 'drop', 
        x: nums[0] || 0, 
        y: nums[1] || 0, 
        blur: nums[2] || 0, 
        spread: nums[3] || 0, 
        color, 
        visible: true 
      });
    });
  }

  document.body.removeChild(tempDiv);
  return { name: 'Figma Layer', width, height, corners, fills, shadows, opacity: 1 };
};
