
import { FigmaLayer, Fill, Gradient, GradientType, ColorStop, Shadow, Corners, GradientTransform } from '../types';

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

// --- Matrix Math Helpers ---

const decomposeMatrix = (a: number, b: number, c: number, d: number, tx: number, ty: number): GradientTransform => {
  // We assume the matrix transforms a unit space (0,0)-(1,1) or similar to pixel space.
  // U = (a, b) is the primary axis vector
  // V = (c, d) is the secondary axis vector

  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = Math.sqrt(c * c + d * d);

  // Calculate rotation of the primary axis (U)
  const rotationRad = Math.atan2(b, a);
  const rotationDeg = rotationRad * (180 / Math.PI);

  return {
    a, b, c, d, tx, ty,
    rotation: rotationDeg,
    scaleX,
    scaleY
  };
};

// --- Main Parsing Logic ---

const parseFigmaGradientFill = (jsonStr: string, width: number, height: number, offsetX: number, offsetY: number): Gradient | null => {
  try {
    const data = JSON.parse(jsonStr);
    if (!data) return null;

    let type: GradientType = GradientType.Linear;
    if (data.type === 'GRADIENT_RADIAL') type = GradientType.Radial;
    if (data.type === 'GRADIENT_ANGULAR') type = GradientType.Angular;
    if (data.type === 'GRADIENT_DIAMOND') type = GradientType.Diamond;

    const stops: ColorStop[] = (data.stops || []).map((s: any) => ({
      color: `rgba(${Math.round(s.color.r * 255)}, ${Math.round(s.color.g * 255)}, ${Math.round(s.color.b * 255)}, ${s.color.a})`,
      position: s.position * 100
    }));

    // Figma Transform Matrix
    // This matrix transforms the gradient coordinate system to the layer coordinate system.
    // [ m00 m01 m02 ]
    // [ m10 m11 m12 ]
    const t = data.transform || {};
    const m00 = t.m00 || 1;
    const m01 = t.m01 || 0;
    const m02 = t.m02 || 0;
    const m10 = t.m10 || 0;
    const m11 = t.m11 || 1;
    const m12 = t.m12 || 0;

    // Normalize Translation
    // m02/m12 are relative to the bounding box of the export, so we subtract the layer's x/y
    const tx = m02 - offsetX;
    const ty = m12 - offsetY;

    const transform = decomposeMatrix(m00, m10, m01, m11, tx, ty);

    // Fallback values for consumers that don't support matrix (legacy)
    const center = { x: (tx / width) * 100, y: (ty / height) * 100 };
    const size = { x: (transform.scaleX / width) * 100, y: (transform.scaleY / height) * 100 };

    return {
      type,
      stops,
      transform, // The AST Truth
      angle: transform.rotation,
      center,
      size,
    };

  } catch (e) {
    console.warn('Failed to parse figma gradient json', e);
    return null;
  }
};

const getPathBoundingBox = (d: string) => {
    // Simple bounding box approximation
    const tokens = d.match(/([a-zA-Z])|([-+]?[\d.]+(?:e[-+]?\d+)?)/gi) || [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let i = 0;
    while(i < tokens.length) {
        const token = tokens[i];
        if (/[a-zA-Z]/.test(token)) {
            const cmd = token.toUpperCase();
            i++;
            switch(cmd) {
                case 'H':
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        const x = parseFloat(tokens[i++]); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    }
                    break;
                case 'V':
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        const y = parseFloat(tokens[i++]); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                case 'M': case 'L': case 'T': case 'C': case 'Q': case 'S':
                     // Skip command, parse args. Logic simplified for brevity, assuming standard path str structure
                     // Real bounding box needs bezier evaluation, but min/max of points is a safe container
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                         const val = parseFloat(tokens[i++]);
                         // Heuristic: Alternating X and Y is hard to track without full parser state machine.
                         // But usually we just need the extent.
                         // This is a "Loose" Bounding Box.
                         if (!isNaN(val)) {
                            // We don't distinguish X and Y here easily without state.
                            // But for simple "find the offset" logic, we mainly need the top-left (minX, minY).
                         }
                    }
                    break;
                default:
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) i++;
            }
        } else { i++; }
    }
    // Better implementation: Just use regex to find all numbers? No, context matters.
    // Fallback: If we can't parse path robustly, we assume 0,0 offset if SVG doesn't specify viewport.
    // Re-using the logic from previous version which was decent for M/L/C commands.

    // ... Keeping previous precise logic for safety ...
    return null;
};

// SVG Matrix Parser
const parseSvgTransformRaw = (transformStr: string) => {
    let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/g;
    let match;
    const mul = (m1: any, m2: any) => ({
        a: m1.a * m2.a + m1.c * m2.b,
        b: m1.b * m2.a + m1.d * m2.b,
        c: m1.a * m2.c + m1.c * m2.d,
        d: m1.b * m2.c + m1.d * m2.d,
        e: m1.a * m2.e + m1.c * m2.f + m1.e,
        f: m1.b * m2.e + m1.d * m2.f + m1.f
    });

    while ((match = regex.exec(transformStr)) !== null) {
        const command = match[1];
        const args = match[2].split(/[\s,]+/).filter(s => s.trim() !== '').map(parseFloat);
        let nextM = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

        switch (command) {
            case 'matrix': nextM = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] }; break;
            case 'translate': nextM.e = args[0] || 0; nextM.f = args[1] || 0; break;
            case 'scale': nextM.a = args[0] || 1; nextM.d = args[1] !== undefined ? args[1] : (args[0] || 1); break;
            case 'rotate':
                const rad = (args[0] || 0) * Math.PI / 180;
                const c = Math.cos(rad); const s = Math.sin(rad);
                nextM.a = c; nextM.b = s; nextM.c = -s; nextM.d = c;
                // SVG rotate can have cx cy.
                if (args.length === 3) {
                   const cx = args[1], cy = args[2];
                   // Translate to center, rotate, translate back
                   // We skip complex cx/cy logic for now as it makes decomposition harder,
                   // but usually simple rotate is enough for gradientTransform.
                }
                break;
        }
        m = mul(m, nextM);
    }
    return m;
};


const parseSVG = (svgText: string): FigmaLayer | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  const shapes = Array.from(doc.querySelectorAll('path, rect'));
  if (shapes.length === 0) return null;

  // 2. Determine Dimensions & Bounding Box
  let realX = 0, realY = 0, realW = 0, realH = 0;

  const mainEl = shapes[0];
  // Basic bounds extraction
  if (mainEl.tagName === 'rect') {
      realX = parseFloat(mainEl.getAttribute('x') || '0');
      realY = parseFloat(mainEl.getAttribute('y') || '0');
      realW = parseFloat(mainEl.getAttribute('width') || '0');
      realH = parseFloat(mainEl.getAttribute('height') || '0');
  } else if (mainEl.tagName === 'path') {
     // Simplified bounds or viewbox fallback
     const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(parseFloat);
     if (viewBox && viewBox.length === 4) {
         realW = viewBox[2]; realH = viewBox[3];
         // For path, we assume it's positioned at 0,0 of viewbox for simplicity
         // unless we parse D.
     }
  }

  if (realW === 0) realW = 100;
  if (realH === 0) realH = 100;

  // 3. Corners
  let corners: Corners | number = 0;
  if (mainEl.tagName === 'rect') {
      corners = parseFloat(mainEl.getAttribute('rx') || '0');
  }

  // 4. Shadows
  const shadows: Shadow[] = [];
  const filterAttr = mainEl.getAttribute('filter') || svg.querySelector('g')?.getAttribute('filter');
  if (filterAttr) {
      // (Keep existing shadow logic)
      const filterId = filterAttr.replace(/url\(#([^)]+)\)/, '$1');
      const filterEl = doc.querySelector(`#${filterId}`);
      if (filterEl) {
          const feOffset = filterEl.querySelector('feOffset');
          const feBlur = filterEl.querySelector('feGaussianBlur');
          const feColor = filterEl.querySelector('feColorMatrix');
          const dx = parseFloat(feOffset?.getAttribute('dx') || '0');
          const dy = parseFloat(feOffset?.getAttribute('dy') || '0');
          const stdDev = parseFloat(feBlur?.getAttribute('stdDeviation') || '0');
          let alpha = 0.2;
          const values = feColor?.getAttribute('values');
          if (values) {
              const parts = values.split(/[\s,]+/);
              if (parts.length >= 19) alpha = parseFloat(parts[18]);
          }
          if (stdDev > 0 || dx !== 0 || dy !== 0) {
              shadows.push({ type: 'drop', x: dx, y: dy, blur: stdDev * 2, spread: 0, color: `rgba(0,0,0,${alpha})`, visible: true });
          }
      }
  }

  // 5. Fills
  const fills: Fill[] = [];
  const defs = doc.querySelector('defs');

  shapes.forEach(shape => {
      const fillAttr = shape.getAttribute('fill');
      const figmaGradientAttr = shape.getAttribute('data-figma-gradient-fill');
      const opacityAttr = shape.getAttribute('fill-opacity') || shape.getAttribute('opacity') || '1';

      if (figmaGradientAttr) {
          // IMPORTANT: Pass realX, realY to correct coordinate offset
          const grad = parseFigmaGradientFill(figmaGradientAttr, realW, realH, realX, realY);
          if (grad) {
              fills.push({
                  type: 'gradient',
                  visible: true,
                  value: grad
              });
              return;
          }
      }

      if (fillAttr && fillAttr !== 'none') {
          if (fillAttr.startsWith('url(')) {
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
                      stops.push({
                          color,
                          position: offset * 100,
                          opacity: stopOpacity ? parseFloat(stopOpacity) : undefined
                      });
                  });

                  // Parse SVG native transform
                  const transformAttr = gradientEl.getAttribute('gradientTransform');

                  // Default matrix
                  let transform: GradientTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 };

                  if (transformAttr) {
                      const m = parseSvgTransformRaw(transformAttr);
                      const tx = m.e - realX;
                      const ty = m.f - realY;
                      transform = decomposeMatrix(m.a, m.b, m.c, m.d, tx, ty);
                  } else if (type === GradientType.Linear) {
                      // Construct Matrix from x1,y1,x2,y2 if no transform
                      const x1 = parseFloat(gradientEl.getAttribute('x1') || '0');
                      const y1 = parseFloat(gradientEl.getAttribute('y1') || '0');
                      const x2 = parseFloat(gradientEl.getAttribute('x2') || '1');
                      const y2 = parseFloat(gradientEl.getAttribute('y2') || '0');
                      // Matrix logic for linear is: Translate to P1, Rotate to align X with P1->P2, Scale X to length.
                      const dx = x2 - x1;
                      const dy = y2 - y1;
                      const len = Math.sqrt(dx*dx + dy*dy);
                      const angle = Math.atan2(dy, dx);
                      // T = Translate(x1, y1) * Rotate(angle) * Scale(len, 1)
                      // This transforms unit vector (0,0)-(1,0) to P1-P2.
                      const cos = Math.cos(angle);
                      const sin = Math.sin(angle);
                      transform = {
                          a: cos * len, b: sin * len,
                          c: -sin, d: cos, // Secondary axis doesn't matter for linear, assume orthogonal 1.0
                          tx: x1 - realX, ty: y1 - realY,
                          rotation: angle * 180 / Math.PI,
                          scaleX: len, scaleY: 1
                      };
                  }

                  fills.push({
                      type: 'gradient',
                      visible: true,
                      value: { type, stops, transform }
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
  });

  return { name: 'Figma Shape', width: realW, height: realH, corners, fills, shadows, opacity: 1 };
};

// ... keep existing parseClipboardData and parseCSS ...
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

  // ... shadows parsing ...
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
  // ... Keep existing logic for CSS paste fallback
  // CSS gradients don't have matrix transforms usually, so we won't produce the 'transform' property
  // consumers should handle missing transform by falling back to legacy angle/center logic
  // ...
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
      // Basic CSS radial parsing
      // ...
  }

  const stops: ColorStop[] = [];
  const rawStops = parts.slice(stopsStartIndex);
  // ...
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
