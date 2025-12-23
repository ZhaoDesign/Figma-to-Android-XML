
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
      // 解析 "conic-gradient(from 90deg at 50% 50%, ...)"
      const fromMatch = firstPartLower.match(/from\s+([\d.]+)deg/);
      if (fromMatch) angle = parseFloat(fromMatch[1]);

      const atMatch = firstPartLower.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) center = { x: parseFloat(atMatch[1]), y: parseFloat(atMatch[2]) };

      if (firstPartLower.includes('from') || firstPartLower.includes('at')) {
          stopsStartIndex = 1;
      }
  } else if (isLinear) {
      const degMatch = firstPartLower.match(/([\d.]+)deg/);
      if (degMatch) {
          angle = parseFloat(degMatch[1]);
          stopsStartIndex = 1;
      }
  } else if (isRadial) {
      // 径向渐变解析
      if (firstPartLower.includes(' at ') || firstPartLower.startsWith('at ')) {
          stopsStartIndex = 1;
          const atIndex = firstPartLower.indexOf('at');
          const sizeStr = firstPartLower.substring(0, atIndex).trim();
          const posStr = firstPartLower.substring(atIndex + 2).trim();

          const sizeMatches = sizeStr.match(/([\d.]+)%/g);
          if (sizeMatches && sizeMatches.length >= 2) {
             size = { x: parseFloat(sizeMatches[0]), y: parseFloat(sizeMatches[1]) };
          } else if (sizeMatches && sizeMatches.length === 1) {
             const val = parseFloat(sizeMatches[0]);
             size = { x: val, y: val };
          }

          const posMatches = posStr.match(/([\d.]+)%/g);
          if (posMatches && posMatches.length >= 2) {
              center = { x: parseFloat(posMatches[0]), y: parseFloat(posMatches[1]) };
          }
      } else {
          const pureSizeMatch = firstPartLower.match(/^([\d.]+)%\s+([\d.]+)%$/);
          if (pureSizeMatch) {
             stopsStartIndex = 1;
             size = { x: parseFloat(pureSizeMatch[1]), y: parseFloat(pureSizeMatch[2]) };
          }
      }
      // CSS 不支持径向渐变角度，所以这里默认为 0，稍后由 UI 手动控制
      angle = 0;
  }

  const stops: ColorStop[] = [];
  const rawStops = parts.slice(stopsStartIndex);

  rawStops.forEach((part, index) => {
    const match = part.trim().match(/^([\s\S]+?)(?:\s+(-?[\d.]+(?:%|px|deg|))|)$/);
    if (match) {
      let colorStr = match[1].trim();
      let posVal = match[2];
      let position = 0;

      if (colorStr.includes(' at ') || colorStr.length > 50) return;

      if (posVal) {
          const isDegrees = posVal.includes('deg');
          const val = parseFloat(posVal);

          if (isDegrees) {
              position = (val / 360) * 100;
          } else {
              position = val;
          }
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
