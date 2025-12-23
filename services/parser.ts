
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
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

// Matrix multiplication: m1 * m2
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
  // Identity Matrix
  let m: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  // Regex to match command(args...)
  const regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(transformStr)) !== null) {
    const command = match[1];
    const args = match[2].split(/[\s,]+/).filter(s => s.trim() !== '').map(parseFloat);

    let nextM: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    switch (command) {
      case 'matrix':
        if (args.length >= 6) {
          nextM = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        }
        break;
      case 'translate':
        nextM.e = args[0] || 0;
        nextM.f = args[1] || 0; // If y is not provided, it is assumed to be 0
        break;
      case 'scale':
        nextM.a = args[0] || 1;
        nextM.d = args[1] !== undefined ? args[1] : (args[0] || 1); // If y is not provided, it is assumed to be equal to x
        break;
      case 'rotate':
        const angle = args[0] || 0;
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Basic rotation around 0,0
        nextM.a = cos;
        nextM.b = sin;
        nextM.c = -sin;
        nextM.d = cos;

        // If cx, cy provided: translate(cx, cy) -> rotate -> translate(-cx, -cy)
        if (args.length >= 3) {
          const cx = args[1];
          const cy = args[2];
          // We handle this by combining 3 matrices manually or just adjusting e/f
          // This is rare in Figma export (usually just rotate(angle)), sticking to basic rotate for now to avoid complexity
          // as Figma usually decomposes transforms.
        }
        break;
    }

    m = multiplyMatrices(m, nextM);
  }

  // Decompose Final Matrix
  // Scale X = sqrt(a^2 + b^2)
  const scaleX = Math.sqrt(m.a * m.a + m.b * m.b);

  // Scale Y = sqrt(c^2 + d^2)
  const scaleY = Math.sqrt(m.c * m.c + m.d * m.d);

  // Rotation = atan2(b, a)
  const rotationRad = Math.atan2(m.b, m.a);
  let rotationDeg = rotationRad * 180 / Math.PI;

  return {
    rotation: rotationDeg,
    scaleX,
    scaleY,
    translateX: m.e,
    translateY: m.f
  };
};

// --- SVG Parsing Logic ---

const parseSVG = (svgText: string): FigmaLayer | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  const widthStr = svg.getAttribute('width') || svg.getAttribute('viewBox')?.split(' ')[2] || '0';
  const heightStr = svg.getAttribute('height') || svg.getAttribute('viewBox')?.split(' ')[3] || '0';
  const width = parseFloat(widthStr);
  const height = parseFloat(heightStr);

  let corners: Corners | number = 0;

  // Try to find corners from rect. Figma often exports rect for background.
  // If user copied a selection with Shadow, the root might be a group/viewbox, and the shape is inside.
  const bgRect = doc.querySelector('rect');
  if (bgRect) {
      const rx = parseFloat(bgRect.getAttribute('rx') || '0');
      corners = rx;
  }
  // TODO: Parsing path 'd' for corners is complex. For now, if it's a path, corners might be 0.
  // The user can adjust manually if needed, or we rely on the gradient being correct.

  const fills: Fill[] = [];
  const defs = doc.querySelector('defs');

  // Process elements with fill
  const elements = Array.from(doc.querySelectorAll('path, rect, circle'));

  elements.forEach(el => {
      const fillAttr = el.getAttribute('fill');
      const opacityAttr = el.getAttribute('fill-opacity') || el.getAttribute('opacity') || '1';
      const opacity = parseFloat(opacityAttr);

      if (!fillAttr || fillAttr === 'none') return;

      // 1. Solid Color
      if (fillAttr.startsWith('#') || fillAttr.startsWith('rgb')) {
          fills.push({
              type: 'solid',
              value: fillAttr,
              visible: true,
              opacity: opacity
          });
      }
      // 2. Gradient (url(#id))
      else if (fillAttr.startsWith('url(')) {
          const id = fillAttr.replace(/url\(#([^)]+)\)/, '$1');
          const gradientEl = defs?.querySelector(`#${id}`);

          if (gradientEl) {
              const type = gradientEl.tagName === 'radialGradient' ? GradientType.Radial : GradientType.Linear;
              const stops: ColorStop[] = [];

              Array.from(gradientEl.querySelectorAll('stop')).forEach(stop => {
                  const color = stop.getAttribute('stop-color') || '#000000';
                  const stopOpacity = stop.getAttribute('stop-opacity');
                  const offsetStr = stop.getAttribute('offset') || '0';

                  let offset = parseFloat(offsetStr);
                  if (offsetStr.includes('%')) offset /= 100;

                  // For simplicity we keep color as is, generator/preview handles hex/rgba
                  stops.push({ color: color, position: offset * 100 });
              });

              // *** Transform Parsing ***
              const transformAttr = gradientEl.getAttribute('gradientTransform');
              let angle = 0;
              let size = { x: 50, y: 50 }; // percentages
              let center = { x: 50, y: 50 };

              if (transformAttr) {
                  const t = parseSvgTransform(transformAttr);

                  // 1. Rotation
                  angle = t.rotation;

                  // 2. Center (Translate)
                  // In matrix logic, (0,0) is mapped to (e, f).
                  // width/height here are the viewbox dimensions.
                  center = {
                      x: (t.translateX / width) * 100,
                      y: (t.translateY / height) * 100
                  };

                  // 3. Size (Scale)
                  // Figma exports radial gradient with r="1" usually.
                  // So the scaleX/scaleY directly correspond to the pixel radii.
                  size = {
                      x: (t.scaleX / width) * 100,
                      y: (t.scaleY / height) * 100
                  };
              } else {
                  if (type === GradientType.Linear) {
                      const x1 = parseFloat(gradientEl.getAttribute('x1') || '0');
                      const x2 = parseFloat(gradientEl.getAttribute('x2') || '1');
                      const y1 = parseFloat(gradientEl.getAttribute('y1') || '0');
                      const y2 = parseFloat(gradientEl.getAttribute('y2') || '0');

                      const dx = x2 - x1;
                      const dy = y2 - y1;
                      angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
                  }
              }

              fills.push({
                  type: 'gradient',
                  visible: true,
                  value: {
                      type,
                      stops,
                      angle,
                      center,
                      size
                  }
              });
          }
      }
  });

  return {
      name: 'SVG Import',
      width,
      height,
      corners,
      fills,
      shadows: [],
      opacity: 1
  };
};

// --- Main Parse Function ---

export const parseClipboardData = (text: string): FigmaLayer | null => {
  // 1. Try SVG First (Perfect fidelity)
  if (text.trim().startsWith('<svg') || text.includes('xmlns="http://www.w3.org/2000/svg"')) {
      try {
          const svgLayer = parseSVG(text);
          if (svgLayer) return svgLayer;
      } catch (e) {
          console.warn("SVG Parsing failed, falling back to CSS", e);
      }
  }

  // 2. Fallback to CSS
  return parseCSS(text);
};

// ... 原有的 parseCSS 逻辑移动到这里 ...
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

  // Parse Background Image (Gradients)
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

  // Parse Background Color (Solid)
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

// 导出 parseGradient 供内部 CSS 解析使用
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
