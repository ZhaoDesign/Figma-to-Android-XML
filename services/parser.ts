import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Shadow, Corners } from '../types';

const pxToNum = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.replace('px', '')) || 0;
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
  if (!isLinear && !isRadial) return null;

  const firstParen = gradientStr.indexOf('(');
  const lastParen = gradientStr.lastIndexOf(')');
  if (firstParen === -1 || lastParen === -1) return null;

  const content = gradientStr.substring(firstParen + 1, lastParen);
  const parts = splitCSSLayers(content);
  if (parts.length === 0) return null;

  let angle = 180;
  let stopsStartIndex = 0;
  let rawGeometry: string | undefined = undefined;

  const firstPart = parts[0];
  const firstPartLower = firstPart.toLowerCase();
  let isGeometry = false;

  if (isLinear) {
    isGeometry = firstPartLower.includes('deg') || firstPartLower.includes('to ') || !!firstPartLower.match(/^\d+(\.\d+)?(turn|rad|grad)$/);
  } else {
    const keywords = ['circle', 'ellipse', 'at', 'center', 'top', 'bottom', 'left', 'right'];
    isGeometry = keywords.some(k => firstPartLower.includes(k)) || /^[\d.]/.test(firstPartLower);
  }

  if (isGeometry) {
    stopsStartIndex = 1;
    rawGeometry = firstPart;
    if (isLinear) {
        if (firstPartLower.includes('deg')) {
          angle = parseFloat(firstPartLower);
        } else {
          if (firstPartLower.includes('to top')) angle = 0;
          else if (firstPartLower.includes('to right')) angle = 90;
          else if (firstPartLower.includes('to bottom')) angle = 180;
          else if (firstPartLower.includes('to left')) angle = 270;
          else if (firstPartLower.includes('top') && firstPartLower.includes('right')) angle = 45;
          else if (firstPartLower.includes('bottom') && firstPartLower.includes('right')) angle = 135;
          else if (firstPartLower.includes('bottom') && firstPartLower.includes('left')) angle = 225;
          else if (firstPartLower.includes('top') && firstPartLower.includes('left')) angle = 315;
        }
    }
  }

  const stops: ColorStop[] = [];
  const stopParts = parts.slice(stopsStartIndex);
  stopParts.forEach((part, index) => {
    const match = part.match(/^([\s\S]+?)(?:\s+(-?[\d.]+%?|-?[\d.]+px))?$/);
    if (match) {
      let colorStr = match[1].trim();
      let positionStr = match[2];
      let position = positionStr ? parseFloat(positionStr) : (index === 0 ? 0 : index === stopParts.length - 1 ? 100 : (index / (stopParts.length - 1)) * 100);
      stops.push({ color: colorStr, position });
    }
  });

  return { type: isLinear ? GradientType.Linear : GradientType.Radial, angle, rawGeometry, stops };
};

export const parseClipboardData = (text: string): FigmaLayer | null => {
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  let cleanText = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[{}]/g, '').replace(/\n/g, ' ');
  if (!cleanText.includes(':')) {
    const trimmed = cleanText.trim();
    if (trimmed.startsWith('linear-gradient') || trimmed.startsWith('radial-gradient') || trimmed.startsWith('#') || trimmed.startsWith('rgb')) {
      cleanText = `background: ${trimmed}`;
    }
  }

  tempDiv.setAttribute('style', cleanText);
  const style = tempDiv.style;
  const width = pxToNum(style.width) || 200;
  const height = pxToNum(style.height) || 60;
  const radiusStr = style.borderRadius || '0px';
  const radii = radiusStr.split(' ').map(pxToNum);
  let corners: number | Corners = radii[0] || 0;
  if (radii.length === 2) corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[0], bottomLeft: radii[1] };
  else if (radii.length === 4) corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[2], bottomLeft: radii[3] };

  const fills: Fill[] = [];
  const bgImage = style.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    splitCSSLayers(bgImage).forEach(layer => {
      const gradient = parseGradient(layer);
      if (gradient) fills.push({ type: 'gradient', value: gradient, visible: true });
      else if (layer.includes('url')) {
          const type = layer.toLowerCase().includes('noise') ? 'noise' : 'texture';
          const urlMatch = layer.match(/url\(['"]?([^'"]+)['"]?\)/);
          fills.push({ type, value: 'image', assetUrl: urlMatch ? urlMatch[1] : undefined, visible: true });
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
      const cleanLayer = layer.replace('inset', '').trim();
      const colorMatch = cleanLayer.match(/(rgba?\(.*?\)|#[\da-fA-F]+|[a-z]+)/i);
      const color = colorMatch ? colorMatch[0] : '#000000';
      const nums = cleanLayer.replace(color, '').trim().split(/\s+/).map(pxToNum);
      shadows.push({ type: isInner ? 'inner' : 'drop', x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, color, visible: true });
    });
  }

  // Blurs
  const backdropFilter = style.backdropFilter || (style as any).webkitBackdropFilter;
  const filter = style.filter;
  let backdropBlur = 0;
  let layerBlur = 0;
  if (backdropFilter && backdropFilter.includes('blur')) {
      const match = backdropFilter.match(/blur\(([^)]+)\)/);
      if (match) backdropBlur = pxToNum(match[1]);
  }
  if (filter && filter.includes('blur')) {
      const match = filter.match(/blur\(([^)]+)\)/);
      if (match) layerBlur = pxToNum(match[1]);
  }

  document.body.removeChild(tempDiv);
  return { name: 'Figma Layer', width, height, corners, fills, shadows, opacity: 1, blur: layerBlur, backdropBlur };
};
