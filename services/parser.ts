import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Shadow, Corners } from '../types';

// Helper to parse rgba/rgb to hex
const rgbToHex = (color: string): string => {
  if (color.startsWith('#')) return color;
  
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = color;
  return ctx.fillStyle;
};

// Helper to extract numeric value from px string
const pxToNum = (val: string): number => {
  return parseFloat(val.replace('px', '')) || 0;
};

// Robust CSS function splitter that handles nested parentheses (e.g. rgba inside linear-gradient)
const splitCSSLayers = (cssValue: string): string[] => {
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
  const isLinear = gradientStr.includes('linear-gradient');
  const isRadial = gradientStr.includes('radial-gradient');
  
  if (!isLinear && !isRadial) return null;

  // Remove function wrapper
  const content = gradientStr.substring(gradientStr.indexOf('(') + 1, gradientStr.lastIndexOf(')'));
  const parts = splitCSSLayers(content);
  
  let angle = 180; // Default to bottom
  let stopsStartIndex = 0;

  // Check for angle or direction in the first part
  if (isLinear && (parts[0].includes('deg') || parts[0].includes('to '))) {
    stopsStartIndex = 1;
    if (parts[0].includes('deg')) {
      angle = parseFloat(parts[0]);
    } else {
      // Map 'to right', etc.
      if (parts[0].includes('to top')) angle = 0;
      else if (parts[0].includes('to right')) angle = 90;
      else if (parts[0].includes('to bottom')) angle = 180;
      else if (parts[0].includes('to left')) angle = 270;
      // Combinations like 'to bottom right' are approx 135
      if (parts[0].includes('bottom') && parts[0].includes('right')) angle = 135;
    }
  }

  const stops: ColorStop[] = [];
  // Parse stops
  const stopParts = parts.slice(stopsStartIndex);
  
  stopParts.forEach((part, index) => {
    // Part looks like "rgba(255, 0, 0, 1) 0%" or "#FFF 100%"
    // Or just color if implied position
    const match = part.match(/(#[\da-f]{3,8}|rgba?\(.*?\)|[a-z]+)(?:\s+([\d.]+%?))?/i);
    if (match) {
      let position = 0;
      if (match[2]) {
        position = parseFloat(match[2]);
      } else {
        // Infer position
        position = index === 0 ? 0 : index === stopParts.length - 1 ? 100 : (index / (stopParts.length - 1)) * 100;
      }
      stops.push({
        color: match[1],
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
  // We assume the user copies "Properties" or "CSS" from Figma, or we parse a block of CSS.
  // We create a dummy element to let the browser parse the CSS for us where possible.
  
  const tempDiv = document.createElement('div');
  tempDiv.style.display = 'none';
  document.body.appendChild(tempDiv);

  // Clean input to look like a style block content
  const cleanText = text.replace(/[{}]/g, '').replace(/\n/g, ';');
  tempDiv.setAttribute('style', cleanText);

  const style = tempDiv.style;
  
  // 1. Dimensions
  const width = pxToNum(style.width) || 200;
  const height = pxToNum(style.height) || 60;
  
  // 2. Corners
  const radiusStr = style.borderRadius || '0px';
  // Check if uniform or individual
  const radii = radiusStr.split(' ').map(pxToNum);
  let corners: number | Corners = 0;
  
  if (radii.length === 1) {
    corners = radii[0];
  } else if (radii.length === 2) {
    // top-left/bottom-right | top-right/bottom-left
    corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[0], bottomLeft: radii[1] };
  } else if (radii.length === 4) {
    corners = { topLeft: radii[0], topRight: radii[1], bottomRight: radii[2], bottomLeft: radii[3] };
  } else {
    // Fallback or 3 values (weird CSS shorthand)
    corners = radii[0] || 0;
  }

  // 3. Fills (Backgrounds)
  const fills: Fill[] = [];
  const bgImage = style.backgroundImage;
  const bgColor = style.backgroundColor;

  // If there are multiple background images (gradients), they are comma separated
  if (bgImage && bgImage !== 'none') {
    const layers = splitCSSLayers(bgImage);
    // CSS renders first layer on TOP. Figma/Android usually lists bottom-to-top in some contexts, 
    // but <layer-list> draws first item at bottom. 
    // Wait, <layer-list> draws standard painter's algorithm: last item is on top.
    // CSS: first item is on top. 
    // We will parse them in CSS order (Top -> Bottom).
    
    layers.forEach(layer => {
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

  // If there is a background color, it's usually the bottom-most layer in CSS logic if used with images
  if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
    fills.push({
      type: 'solid',
      value: bgColor,
      visible: true
    });
  }

  // 4. Shadows
  const shadows: Shadow[] = [];
  const boxShadow = style.boxShadow;
  
  if (boxShadow && boxShadow !== 'none') {
    const shadowLayers = splitCSSLayers(boxShadow);
    shadowLayers.forEach(layer => {
      // Parse shadow: "inset 0px 4px 4px rgba(0, 0, 0, 0.25)"
      // Regex is tricky, let's try a simple split approach knowing the structure
      const isInner = layer.includes('inset');
      const cleanLayer = layer.replace('inset', '').trim();
      
      // Find color (starts with #, rgb, rgba)
      const colorMatch = cleanLayer.match(/(rgba?\(.*?\)|#[\da-f]+|[a-z]+)/i);
      const color = colorMatch ? colorMatch[0] : '#000000';
      
      // Remove color to find nums
      const numsStr = cleanLayer.replace(color, '').trim();
      const nums = numsStr.split(/\s+/).map(pxToNum);
      
      // usually: x y blur spread
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