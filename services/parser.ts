
import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Shadow, Corners } from '../types';

// --- CSS Helpers ---
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

// --- SVG Helpers ---

interface Matrix {
  a: number; b: number;
  c: number; d: number;
  e: number; f: number;
}

interface TransformData {
  rotation: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

const multiplyMatrices = (m1: Matrix, m2: Matrix): Matrix => {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f
  };
};

const parseSvgTransform = (transformStr: string): TransformData => {
  let m: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(transformStr)) !== null) {
    const command = match[1];
    const args = match[2].split(/[\s,]+/).filter(s => s.trim() !== '').map(parseFloat);
    let nextM: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    switch (command) {
      case 'matrix':
        if (args.length >= 6) nextM = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        break;
      case 'translate':
        nextM.e = args[0] || 0;
        nextM.f = args[1] !== undefined ? args[1] : 0;
        break;
      case 'scale':
        nextM.a = args[0] || 1;
        nextM.d = args[1] !== undefined ? args[1] : (args[0] || 1);
        break;
      case 'rotate':
        const angle = args[0] || 0;
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        nextM.a = cos; nextM.b = sin; nextM.c = -sin; nextM.d = cos;
        break;
    }
    m = multiplyMatrices(m, nextM);
  }

  const scaleX = Math.sqrt(m.a * m.a + m.b * m.b);
  const scaleY = Math.sqrt(m.c * m.c + m.d * m.d);
  const rotationRad = Math.atan2(m.b, m.a);
  let rotationDeg = rotationRad * 180 / Math.PI;

  return { rotation: rotationDeg, scaleX, scaleY, translateX: m.e, translateY: m.f };
};

// Calculate Bounding Box from SVG Path Data (Approximation)
const getPathBoundingBox = (d: string) => {
    // This is a simple parser that extracts coordinates.
    // It assumes Figma's clean export format (Absolute Uppercase commands).

    // Commands: M x y, L x y, H x, V y, C x1 y1 x2 y2 x y, etc.
    const tokens = d.match(/([a-zA-Z])|([-+]?[\d.]+(?:e[-+]?\d+)?)/gi) || [];

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    let i = 0;
    while(i < tokens.length) {
        const token = tokens[i];
        if (/[a-zA-Z]/.test(token)) {
            const cmd = token.toUpperCase();
            i++;

            switch(cmd) {
                case 'M':
                case 'L':
                case 'T': // x y
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        const x = parseFloat(tokens[i++]);
                        const y = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                case 'H': // x
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        const x = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    }
                    break;
                case 'V': // y
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        const y = parseFloat(tokens[i++]);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                case 'C': // x1 y1 x2 y2 x y
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        i+=4; // skip control points (rough bbox)
                        const x = parseFloat(tokens[i++]);
                        const y = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                case 'Q': // x1 y1 x y
                case 'S':
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        i+=2; // skip control points
                        const x = parseFloat(tokens[i++]);
                        const y = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                case 'Z':
                    break;
                default:
                    // Unknown command, skip till next alpha
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) i++;
            }
        } else {
             i++;
        }
    }

    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

// --- SVG Parsing Logic ---

const parseSVG = (svgText: string): FigmaLayer | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  // 1. Identify the main shape
  // Figma usually puts the shape in a path or rect.
  const path = doc.querySelector('path');
  const rect = doc.querySelector('rect');
  const mainEl = path || rect;

  if (!mainEl) return null; // No shape found

  let realX = 0, realY = 0, realW = 0, realH = 0;

  // 2. Determine Dimensions (Smart Crop)
  if (mainEl.tagName === 'rect') {
      realX = parseFloat(mainEl.getAttribute('x') || '0');
      realY = parseFloat(mainEl.getAttribute('y') || '0');
      realW = parseFloat(mainEl.getAttribute('width') || '0');
      realH = parseFloat(mainEl.getAttribute('height') || '0');
  } else if (mainEl.tagName === 'path') {
      const d = mainEl.getAttribute('d') || '';
      const bbox = getPathBoundingBox(d);
      if (bbox) {
          realX = bbox.x;
          realY = bbox.y;
          realW = bbox.width;
          realH = bbox.height;
      } else {
          // Fallback to ViewBox
          const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(parseFloat);
          if (viewBox && viewBox.length === 4) {
              realW = viewBox[2]; realH = viewBox[3];
          }
      }
  }

  // Fallback defaults
  if (realW === 0) realW = 100;
  if (realH === 0) realH = 100;

  // 3. Corners
  let corners: Corners | number = 0;
  if (rect) {
      corners = parseFloat(rect.getAttribute('rx') || '0');
  } else {
      // Heuristic: if path is likely a pill (C commands present), set corners to height/2
      const d = path?.getAttribute('d') || '';
      if (d.includes('C')) {
          corners = realH / 2; // Auto-guess Pill shape
      }
  }

  // 4. Shadows (Filter Parsing)
  const shadows: Shadow[] = [];
  const filterAttr = mainEl.getAttribute('filter') || svg.querySelector('g')?.getAttribute('filter');
  if (filterAttr) {
      const filterId = filterAttr.replace(/url\(#([^)]+)\)/, '$1');
      const filterEl = doc.querySelector(`#${filterId}`);
      if (filterEl) {
          const feOffset = filterEl.querySelector('feOffset');
          const feBlur = filterEl.querySelector('feGaussianBlur');
          const feColor = filterEl.querySelector('feColorMatrix');

          const dx = parseFloat(feOffset?.getAttribute('dx') || '0');
          const dy = parseFloat(feOffset?.getAttribute('dy') || '0');
          const stdDev = parseFloat(feBlur?.getAttribute('stdDeviation') || '0');

          let alpha = 0.2; // Default shadow alpha
          const values = feColor?.getAttribute('values');
          if (values) {
              const parts = values.split(/[\s,]+/);
              if (parts.length >= 19) {
                  // Standard matrix for alpha tint: 0 0 0 0 R, 0 0 0 0 G, 0 0 0 0 B, 0 0 0 A 0
                  alpha = parseFloat(parts[18]);
              }
          }

          if (stdDev > 0 || dx !== 0 || dy !== 0) {
              shadows.push({
                  type: 'drop',
                  x: dx,
                  y: dy,
                  blur: stdDev * 2, // SVG stdDev is approx half CSS blur
                  spread: 0,
                  color: `rgba(0,0,0,${alpha})`,
                  visible: true
              });
          }
      }
  }

  // 5. Fills & Gradients
  const fills: Fill[] = [];
  const defs = doc.querySelector('defs');

  const fillAttr = mainEl.getAttribute('fill');
  const opacityAttr = mainEl.getAttribute('fill-opacity') || mainEl.getAttribute('opacity') || '1';

  if (fillAttr && fillAttr !== 'none') {
      if (fillAttr.startsWith('url(')) {
          const id = fillAttr.replace(/url\(#([^)]+)\)/, '$1');
          const gradientEl = defs?.querySelector(`#${id}`);
          if (gradientEl) {
               const type = gradientEl.tagName === 'radialGradient' ? GradientType.Radial : GradientType.Linear;
               const stops: ColorStop[] = [];
               Array.from(gradientEl.querySelectorAll('stop')).forEach(stop => {
                  const color = stop.getAttribute('stop-color') || '#000000';
                  const offsetStr = stop.getAttribute('offset') || '0';
                  let offset = parseFloat(offsetStr);
                  if (offsetStr.includes('%')) offset /= 100;
                  stops.push({ color, position: offset * 100 });
              });

              // Transform Processing
              const transformAttr = gradientEl.getAttribute('gradientTransform');
              let angle = 0;
              let center = { x: 50, y: 50 };
              let size = { x: 50, y: 50 };

              if (transformAttr) {
                  const t = parseSvgTransform(transformAttr);
                  angle = t.rotation;

                  // CRITICAL: Normalize Translate relative to the Shape Bounding Box
                  // SVG Gradient Transform is in Global ViewBox coords.
                  // We need it in Shape coords (0..width, 0..height).
                  const localTx = t.translateX - realX;
                  const localTy = t.translateY - realY;

                  center = {
                      x: (localTx / realW) * 100,
                      y: (localTy / realH) * 100
                  };

                  // Scale is absolute pixels, convert to percentage of shape size
                  size = {
                      x: (t.scaleX / realW) * 100,
                      y: (t.scaleY / realH) * 100
                  };
              }

              fills.push({
                  type: 'gradient',
                  visible: true,
                  value: { type, stops, angle, center, size }
              });
          }
      } else {
          fills.push({
              type: 'solid',
              value: fillAttr,
              visible: true,
              opacity: parseFloat(opacityAttr)
          });
      }
  }

  return {
      name: 'Figma Shape',
      width: realW,
      height: realH,
      corners,
      fills,
      shadows,
      opacity: 1
  };
};

export const parseClipboardData = (text: string): FigmaLayer | null => {
  if (text.trim().startsWith('<svg') || text.includes('xmlns="http://www.w3.org/2000/svg"')) {
      try {
          const svgLayer = parseSVG(text);
          if (svgLayer) return svgLayer;
      } catch (e) {
          console.warn("SVG Parsing failed", e);
      }
  }
  return parseCSS(text);
};

const parseCSS = (text: string): FigmaLayer | null => {
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
  let size = { x: 50, y: 50 };

  const firstPart = parts[0].trim();
  const firstPartLower = firstPart.toLowerCase();

  if (isConic) {
      const fromMatch = firstPartLower.match(/from\s+([\d.]+)deg/);
      if (fromMatch) angle = parseFloat(fromMatch[1]);
      const atMatch = firstPartLower.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) center = { x: parseFloat(atMatch[1]), y: parseFloat(atMatch[2]) };
      if (firstPartLower.includes('from') || firstPartLower.includes('at')) stopsStartIndex = 1;
  } else if (isLinear) {
      const degMatch = firstPartLower.match(/([\d.]+)deg/);
      if (degMatch) {
          angle = parseFloat(degMatch[1]);
          stopsStartIndex = 1;
      }
  } else if (isRadial) {
      if (firstPartLower.includes(' at ') || firstPartLower.startsWith('at ')) {
          stopsStartIndex = 1;
          const atIndex = firstPartLower.indexOf('at');
          const sizeStr = firstPartLower.substring(0, atIndex).trim();
          const posStr = firstPartLower.substring(atIndex + 2).trim();
          const sizeMatches = sizeStr.match(/([\d.]+)%/g);
          if (sizeMatches && sizeMatches.length >= 2) {
             size = { x: parseFloat(sizeMatches[0]), y: parseFloat(sizeMatches[1]) };
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
  }

  const stops: ColorStop[] = [];
  const rawStops = parts.slice(stopsStartIndex);

  rawStops.forEach((part, index) => {
    const match = part.trim().match(/^([\s\S]+?)(?:\s+(-?[\d.]+(?:%|px|deg|))|)$/);
    if (match) {
      let colorStr = match[1].trim();
      let posVal = match[2];
      let position = 0;
      if (colorStr.includes(' at ')) return;
      if (posVal) {
          const isDegrees = posVal.includes('deg');
          const val = parseFloat(posVal);
          position = isDegrees ? (val / 360) * 100 : val;
      } else {
          position = rawStops.length > 1 ? (index / (rawStops.length - 1)) * 100 : 0;
      }
      stops.push({ color: colorStr, position });
    }
  });

  return { type, angle, center, size, stops };
};
