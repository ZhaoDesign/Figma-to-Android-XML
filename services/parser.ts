import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Shadow, Corners } from '../types';

// Helper to extract numeric value from px string
const pxToNum = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.replace('px', '')) || 0;
};

// Robust CSS function splitter that handles nested parentheses
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

  // Remove function wrapper: linear-gradient(...) -> ...
  const firstParen = gradientStr.indexOf('(');
  const lastParen = gradientStr.lastIndexOf(')');
  if (firstParen === -1 || lastParen === -1) return null;

  const content = gradientStr.substring(firstParen + 1, lastParen);
  const parts = splitCSSLayers(content);
  
  if (parts.length === 0) return null;

  let angle = 180; // Default to bottom
  let stopsStartIndex = 0;

  // Check for angle or direction in the first part
  // Valid angle formats: "180deg", "to right", "to bottom right"
  const firstPartLower = parts[0].toLowerCase();
  const hasAngle = firstPartLower.includes('deg') || firstPartLower.includes('to ') || firstPartLower.match(/^\d+(\.\d+)?(turn|rad|grad)$/);

  if (hasAngle) {
    stopsStartIndex = 1;
    if (firstPartLower.includes('deg')) {
      angle = parseFloat(firstPartLower);
    } else {
      // Map 'to right', etc.
      if (firstPartLower.includes('to top')) angle = 0;
      else if (firstPartLower.includes('to right')) angle = 90;
      else if (firstPartLower.includes('to bottom')) angle = 180;
      else if (firstPartLower.includes('to left')) angle = 270;
      // Corners
      else if (firstPartLower.includes('top') && firstPartLower.includes('right')) angle = 45;
      else if (firstPartLower.includes('bottom') && firstPartLower.includes('right')) angle = 135;
      else if (firstPartLower.includes('bottom') && firstPartLower.includes('left')) angle = 225;
      else if (firstPartLower.includes('top') && firstPartLower.includes('left')) angle = 315;
    }
  }

  const stops: ColorStop[] = [];
  const stopParts = parts.slice(stopsStartIndex);
  
  // Regex to capture Color and optional Position
  // Handles: #FFF, #FFFFFF, rgba(0,0,0,1), red
  // And: 0%, 100px (though we expect % for gradients mostly)
  stopParts.forEach((part, index) => {
    // 1. Try to split color and position by finding the last space that isn't inside parentheses
    // This is hard with regex alone due to nesting. 
    // Heuristic: Color is usually at start, Position at end.
    
    // Updated regex to be more permissive with color formats (hex, rgb, named)
    // Matches: (color string) (spacing) (percentage/length)
    const match = part.match(/^([\s\S]+?)(?:\s+([\d.]+%?|[\d.]+px))?$/);
    
    if (match) {
      let colorStr = match[1].trim();
      let positionStr = match[2];

      // Clean up color string (remove inner spaces if it's hex, though invalid in CSS, valid for some copies)
      if (colorStr.startsWith('#') && colorStr.includes(' ')) {
          colorStr = colorStr.split(' ')[0];
      }

      let position = 0;
      if (positionStr) {
        position = parseFloat(positionStr);
      } else {
        // Infer position if missing
        position = index === 0 ? 0 : index === stopParts.length - 1 ? 100 : (index / (stopParts.length - 1)) * 100;
      }

      stops.push({
        color: colorStr,
        position
      });
    }
  });

  return {
    type: isLinear ? GradientType.Linear : GradientType.Radial,
    angle,
    stops
  };
};

export const parseClipboardData = (text: string): FigmaLayer | null => {
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  // 1. Clean comments /* ... */
  let cleanText = text.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // 2. Normalize format
  // Remove braces, replace newlines with semicolons, remove trailing commas/semicolons from values
  cleanText = cleanText.replace(/[{}]/g, '').replace(/\n/g, ';');
  
  // 3. Smart Detection: If user pasted JUST the value (e.g. "linear-gradient(...)") without property,
  // we prepend a property name so the browser can parse it.
  if (!cleanText.includes(':')) {
    const trimmed = cleanText.trim();
    if (trimmed.startsWith('linear-gradient') || trimmed.startsWith('radial-gradient') || trimmed.startsWith('#') || trimmed.startsWith('rgb')) {
      cleanText = `background: ${trimmed}`;
    }
  }

  tempDiv.setAttribute('style', cleanText);
  const style = tempDiv.style;
  
  // 1. Dimensions
  const width = pxToNum(style.width) || 200;
  const height = pxToNum(style.height) || 60;
  
  // 2. Corners
  const radiusStr = style.borderRadius || '0px';
  const radii = radiusStr.split(' ').map(pxToNum);
  let corners: number | Corners = 0;
  
  if (radii.length === 1) {
    corners = radii[0];
  } else if (radii.length === 2) {
    corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[0], bottomLeft: radii[1] };
  } else if (radii.length === 4) {
    corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[2], bottomLeft: radii[3] };
  } else {
    corners = radii[0] || 0;
  }

  // 3. Fills
  const fills: Fill[] = [];
  const bgImage = style.backgroundImage;
  const bgColor = style.backgroundColor;

  // Parse Background Images (Gradients)
  if (bgImage && bgImage !== 'none' && bgImage !== 'initial') {
    const layers = splitCSSLayers(bgImage);
    layers.forEach(layer => {
      // Ignore 'url(...)' or other non-gradients for now, unless we want to map them to solid placeholders?
      const gradient = parseGradient(layer);
      if (gradient) {
        fills.push({
          type: 'gradient',
          value: gradient,
          visible: true
        });
      }
    });
  }

  // Parse Background Color
  // Browsers usually put the fallback color in backgroundColor.
  // If we have gradients, we usually keep them on top.
  // If we ONLY have color, add it.
  const hasSolidColor = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== 'initial';
  
  if (hasSolidColor) {
    // If we already have gradients, the solid color is typically the "fallback" or base layer.
    // In Figma CSS, it lists them together.
    fills.push({
      type: 'solid',
      value: bgColor,
      visible: true
    });
  }

  // 4. Shadows
  const shadows: Shadow[] = [];
  const boxShadow = style.boxShadow;
  
  if (boxShadow && boxShadow !== 'none' && boxShadow !== 'initial') {
    const shadowLayers = splitCSSLayers(boxShadow);
    shadowLayers.forEach(layer => {
      const isInner = layer.includes('inset');
      const cleanLayer = layer.replace('inset', '').trim();
      
      // Extract color. Browser standardizes to rgb/rgba first usually.
      // Match rgba(...) or rgb(...) or #HEX
      const colorMatch = cleanLayer.match(/(rgba?\(.*?\)|#[\da-fA-F]+|[a-z]+)/i);
      const color = colorMatch ? colorMatch[0] : '#000000';
      
      const numsStr = cleanLayer.replace(color, '').trim();
      const nums = numsStr.split(/\s+/).map(pxToNum);
      
      shadows.push({
        type: isInner ? 'inner' : 'drop',
        x: nums[0] || 0,
        y: nums[1] || 0,
        blur: nums[2] || 0,
        spread: nums[3] || 0,
        color: color,
        visible: true
      });
    });
  }

  document.body.removeChild(tempDiv);

  // Fallback if nothing found
  if (fills.length === 0 && !hasSolidColor) {
     // If we failed to parse specific fills but width/height worked, maybe it's just white?
     // Or maybe parsing failed. We'll return what we have.
  }

  return {
    name: 'Figma Component',
    width,
    height,
    corners,
    fills,
    shadows,
    opacity: 1
  };
};
