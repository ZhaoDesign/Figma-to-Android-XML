
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

interface TransformData {
  rotation: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

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
    // [ m00 m01 m02 ]
    // [ m10 m11 m12 ]
    const t = data.transform || {};
    const m00 = t.m00 || 1;
    const m01 = t.m01 || 0;
    const m02 = t.m02 || 0;
    const m10 = t.m10 || 0;
    const m11 = t.m11 || 1;
    const m12 = t.m12 || 0;

    // 1. Calculate Local Center
    const localCenterX = m02 - offsetX;
    const localCenterY = m12 - offsetY;

    // 2. Extract Vectors
    const Ux = m00;
    const Uy = m10;
    const Vx = m01;
    const Vy = m11;

    let angleDeg = 0;
    let radiusPx = 0;
    let scaleRatio = 1;

    // --- Special Handling for Angular Gradients ---
    // Figma stores angular gradients with the shape's aspect ratio scaling applied to the matrix.
    // e.g. A button 300x50 will have a very flattened matrix.
    // However, CSS `conic-gradient` and Android `sweep` are circular.
    // To get the correct visual angle (e.g. 8deg) from the flattened vector (e.g. 45deg),
    // we must un-scale the vector by the shape dimensions.
    if (type === GradientType.Angular) {
        // Normalize vectors by dimension to get "Unit Square" direction
        // Avoid divide by zero
        const w = width || 1;
        const h = height || 1;

        const normUx = Ux / w;
        const normUy = Uy / h;

        const angleRad = Math.atan2(normUy, normUx);
        angleDeg = angleRad * 180 / Math.PI;

        // For Angular, we force a circular aspect ratio for Android/CSS compatibility
        // unless specific elliptical sweep is desired (rare/unsupported in native conic).
        radiusPx = w / 2; // Arbitrary base radius
        scaleRatio = 1;   // Force 1:1 circle
    } else {
        // Linear / Radial / Diamond
        // Use raw pixels
        radiusPx = Math.sqrt(Ux * Ux + Uy * Uy);
        const angleRad = Math.atan2(Uy, Ux);
        angleDeg = angleRad * 180 / Math.PI;

        const lengthV = Math.sqrt(Vx * Vx + Vy * Vy);
        scaleRatio = radiusPx > 0.001 ? lengthV / radiusPx : 1;
    }

    // Convert to percentages for the app's internal format
    const cxPct = (localCenterX / width) * 100;
    const cyPct = (localCenterY / height) * 100;

    // Size X% (Base Radius)
    const sxPct = (radiusPx / width) * 100;
    // Size Y%
    const syPct = ((radiusPx * scaleRatio) / height) * 100;

    return {
      type,
      stops,
      angle: angleDeg,
      center: { x: cxPct, y: cyPct },
      size: { x: sxPct, y: syPct },
    };

  } catch (e) {
    console.warn('Failed to parse figma gradient json', e);
    return null;
  }
};

const getPathBoundingBox = (d: string) => {
    const tokens = d.match(/([a-zA-Z])|([-+]?[\d.]+(?:e[-+]?\d+)?)/gi) || [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let i = 0;
    while(i < tokens.length) {
        const token = tokens[i];
        if (/[a-zA-Z]/.test(token)) {
            const cmd = token.toUpperCase();
            i++;
            switch(cmd) {
                case 'M': case 'L': case 'T':
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        const x = parseFloat(tokens[i++]); const y = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
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
                case 'C':
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        i+=4; const x = parseFloat(tokens[i++]); const y = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                case 'Q': case 'S':
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
                        i+=2; const x = parseFloat(tokens[i++]); const y = parseFloat(tokens[i++]);
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                    }
                    break;
                default:
                    while(i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) i++;
            }
        } else { i++; }
    }
    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
  if (mainEl.tagName === 'rect') {
      realX = parseFloat(mainEl.getAttribute('x') || '0');
      realY = parseFloat(mainEl.getAttribute('y') || '0');
      realW = parseFloat(mainEl.getAttribute('width') || '0');
      realH = parseFloat(mainEl.getAttribute('height') || '0');
  } else if (mainEl.tagName === 'path') {
      const d = mainEl.getAttribute('d') || '';
      const bbox = getPathBoundingBox(d);
      if (bbox) {
          realX = bbox.x; realY = bbox.y; realW = bbox.width; realH = bbox.height;
      } else {
          const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(parseFloat);
          if (viewBox && viewBox.length === 4) {
              realW = viewBox[2]; realH = viewBox[3];
          }
      }
  }

  if (realW === 0) realW = 100;
  if (realH === 0) realH = 100;

  // 3. Corners
  let corners: Corners | number = 0;
  if (mainEl.tagName === 'rect') {
      corners = parseFloat(mainEl.getAttribute('rx') || '0');
  } else {
      const d = mainEl.getAttribute('d') || '';
      if (d.includes('C')) corners = realH / 2;
  }

  // 4. Shadows
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

      // ... existing SVG fill parsing (url#...) ...
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

                  const transformAttr = gradientEl.getAttribute('gradientTransform');
                  let angle = 0;
                  let center = { x: 50, y: 50 };
                  let size = { x: 50, y: 50 };
                  let handles = undefined;

                  if (type === GradientType.Linear) {
                      const x1 = gradientEl.getAttribute('x1');
                      const y1 = gradientEl.getAttribute('y1');
                      const x2 = gradientEl.getAttribute('x2');
                      const y2 = gradientEl.getAttribute('y2');

                      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
                          const units = gradientEl.getAttribute('gradientUnits');
                          let sx = parseFloat(x1), sy = parseFloat(y1), ex = parseFloat(x2), ey = parseFloat(y2);

                          if (units !== 'userSpaceOnUse') {
                              if (x1.includes('%')) sx = parseFloat(x1) / 100 * realW;
                              if (y1.includes('%')) sy = parseFloat(y1) / 100 * realH;
                              if (x2.includes('%')) ex = parseFloat(x2) / 100 * realW;
                              if (y2.includes('%')) ey = parseFloat(y2) / 100 * realH;
                          }
                          if (units === 'userSpaceOnUse') {
                              sx -= realX; sy -= realY;
                              ex -= realX; ey -= realY;
                          }
                          handles = { start: { x: sx, y: sy }, end: { x: ex, y: ey } };
                      }
                  }

                  if (transformAttr) {
                      const rawMatrix = parseSvgTransformRaw(transformAttr);
                      const localTx = rawMatrix.e - realX;
                      const localTy = rawMatrix.f - realY;
                      const Ux = rawMatrix.a;
                      const Uy = rawMatrix.b;
                      const Vx = rawMatrix.c;
                      const Vy = rawMatrix.d;

                      const rX = Math.sqrt(Ux*Ux + Uy*Uy);
                      const lenV = Math.sqrt(Vx*Vx + Vy*Vy);
                      const ang = Math.atan2(Uy, Ux) * 180 / Math.PI;

                      center = { x: (localTx / realW) * 100, y: (localTy / realH) * 100 };
                      size = { x: (rX / realW) * 100, y: (lenV / realH) * 100 };
                      angle = ang;
                  }

                  fills.push({
                      type: 'gradient',
                      visible: true,
                      value: { type, stops, angle, center, size, handles }
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

// ... keep helpers and parseClipboardData ...
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
                break;
        }
        m = mul(m, nextM);
    }
    return m;
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
