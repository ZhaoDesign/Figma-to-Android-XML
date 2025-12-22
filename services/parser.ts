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
  let rawGeometry: string | undefined = undefined;

  const firstPart = parts[0];
  const firstPartLower = firstPart.toLowerCase();
  
  // Logic to handle "from [angle] at [x] [y]"
  if (isConic) {
      const fromMatch = firstPartLower.match(/from\s+([\d.]+)deg/);
      if (fromMatch) {
          angle = parseFloat(fromMatch[1]);
          stopsStartIndex = 1;
      }
      const atMatch = firstPartLower.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) {
          center = { x: parseFloat(atMatch[1]), y: parseFloat(atMatch[2]) };
          stopsStartIndex = 1;
      }
  } else if (isLinear) {
      const degMatch = firstPartLower.match(/([\d.]+)deg/);
      if (degMatch) {
          angle = parseFloat(degMatch[1]);
          stopsStartIndex = 1;
      }
  } else if (isRadial) {
      const atMatch = firstPartLower.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) {
          center = { x: parseFloat(atMatch[1]), y: parseFloat(atMatch[2]) };
          stopsStartIndex = 1;
      }
      if (lowerStr.includes('diamond') || lowerStr.includes('ellipse')) {
          type = GradientType.Diamond;
      }
  }

  const stops: ColorStop[] = [];
  parts.slice(stopsStartIndex).forEach((part, index, arr) => {
    // Improved regex to handle colors like rgba() and positions in % or deg
    const match = part.match(/^([\s\S]+?)(?:\s+(-?[\d.]+(?:%|px|deg|))|)$/);
    if (match) {
      let colorStr = match[1].trim();
      let posVal = match[2];
      let position = 0;
      
      if (posVal) {
          if (posVal.includes('%')) position = parseFloat(posVal);
          else if (posVal.includes('deg')) position = (parseFloat(posVal) / 360) * 100;
          else position = parseFloat(posVal);
      } else {
          position = arr.length > 1 ? (index / (arr.length - 1)) * 100 : 0;
      }
      
      stops.push({ color: colorStr, position: isNaN(position) ? 0 : position });
    }
  });

  return { type, angle, center, rawGeometry, stops };
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

  const blendModes = (style.backgroundBlendMode || 'normal').split(',').map(s => s.trim());
  const mainMixBlend = style.mixBlendMode || 'normal';

  const fills: Fill[] = [];
  const bgImage = style.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const layers = splitCSSLayers(bgImage);
    layers.forEach((layer, idx) => {
      const gradient = parseGradient(layer);
      const blendMode = blendModes[idx] || (idx === 0 ? mainMixBlend : 'normal');
      
      if (gradient) {
        fills.push({ type: 'gradient', value: gradient, visible: true, blendMode });
      } else if (layer.includes('url')) {
          const urlMatch = layer.match(/url\(['"]?([^'"]+)['"]?\)/);
          fills.push({ 
            type: layer.toLowerCase().includes('noise') ? 'noise' : 'texture', 
            value: 'image', 
            assetUrl: urlMatch ? urlMatch[1] : undefined, 
            visible: true,
            blendMode
          });
      }
    });
  }
  
  const bgColor = style.backgroundColor;
  if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
    fills.push({ 
        type: 'solid', 
        value: bgColor, 
        visible: true, 
        blendMode: blendModes[fills.length] || 'normal' 
    });
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

  const backdropFilter = style.backdropFilter || (style as any).webkitBackdropFilter;
  const filter = style.filter;
  let backdropBlur = 0, layerBlur = 0;
  
  const extractBlur = (s: string) => {
      const m = s.match(/blur\(([\d.]+)px\)/);
      return m ? parseFloat(m[1]) : 0;
  };
  if (backdropFilter) backdropBlur = extractBlur(backdropFilter);
  if (filter) layerBlur = extractBlur(filter);

  document.body.removeChild(tempDiv);
  return { name: 'Figma Layer', width, height, corners, fills, shadows, opacity: 1, blur: layerBlur, backdropBlur };
};