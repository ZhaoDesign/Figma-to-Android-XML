
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

// 解析 SVG Transform 矩阵: matrix(a, b, c, d, e, f)
// 或者 Figma 有时会输出 translate() rotate() scale() 链
interface TransformData {
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

const parseSvgTransform = (transform: string): TransformData => {
  let a=1, b=0, c=0, d=1, e=0, f=0;

  // 1. 尝试解析 matrix(a,b,c,d,e,f)
  const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(/[\s,]+/).map(parseFloat);
    if (values.length === 6) {
      [a, b, c, d, e, f] = values;
    }
  } else {
    // 2. 尝试解析 rotate(deg) scale(x, y) translate(x, y) 等组合
    // 这是一个简化处理，Figma SVG 通常使用 matrix，但为了健壮性...
    const rotateMatch = transform.match(/rotate\(([\d.-]+)\)/);
    if (rotateMatch) {
       const deg = parseFloat(rotateMatch[1]);
       const rad = deg * Math.PI / 180;
       a = Math.cos(rad); b = Math.sin(rad);
       c = -Math.sin(rad); d = Math.cos(rad);
    }
    // 注意：复合变换的精确解析需要矩阵乘法，这里主要针对 Figma 导出的标准格式
  }

  // 从矩阵提取旋转和缩放
  // Scale X = sqrt(a^2 + b^2)
  const scaleX = Math.sqrt(a*a + b*b);

  // Scale Y = sqrt(c^2 + d^2) (近似，假设无斜切)
  // 实际上 Figma 的径向渐变通常是正交的
  const scaleY = Math.sqrt(c*c + d*d);

  // Rotation = atan2(b, a)
  const rotationRad = Math.atan2(b, a);
  let rotationDeg = rotationRad * 180 / Math.PI;

  return {
    rotation: rotationDeg,
    scaleX,
    scaleY,
    translateX: e,
    translateY: f
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

  // 尝试从 rect 获取圆角
  const bgRect = doc.querySelector('rect');
  if (bgRect) {
      const rx = parseFloat(bgRect.getAttribute('rx') || '0');
      corners = rx;
  }

  const fills: Fill[] = [];
  const defs = doc.querySelector('defs');

  // 处理所有使用 fill 的元素 (path, rect)
  // 我们只看顶层的，或者按顺序看
  const elements = Array.from(doc.querySelectorAll('path, rect, circle'));

  elements.forEach(el => {
      const fillAttr = el.getAttribute('fill');
      const opacityAttr = el.getAttribute('fill-opacity') || el.getAttribute('opacity') || '1';
      const opacity = parseFloat(opacityAttr);

      if (!fillAttr) return;

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

                  // 处理 Hex 透明度
                  let finalColor = color;
                  if (stopOpacity) {
                      // 简单处理：如果是 Hex，这里暂时不转换，由生成器处理，
                      // 或者转换成 rgba。为了保持简单，我们生成器里有 toAndroidHex
                      // 但 Android Hex 是 AARRGGBB，CSS 是 RRGGBB。
                      // 我们这里不改 color 字符串，生成器会处理。
                      // *但在 PreviewCanvas 里需要 rgba*。
                      // 这是一个小坑。为了预览正确，我们最好转成 rgba。
                  }

                  stops.push({ color: finalColor, position: offset * 100 });
              });

              // *** 关键：解析 Transform ***
              const transformAttr = gradientEl.getAttribute('gradientTransform');
              let angle = 0;
              let size = { x: 50, y: 50 }; // percentages relative to layer
              let center = { x: 50, y: 50 };

              if (transformAttr) {
                  const t = parseSvgTransform(transformAttr);

                  // Figma 的 SVG 导出通常是 userSpaceOnUse (像素单位)
                  // 矩阵包含：位移(center), 旋转, 缩放(radius)

                  // 1. Rotation
                  angle = t.rotation;

                  // 2. Center (Translate)
                  // 在 Matrix 变换后，(0,0) 移到了 center。
                  center = {
                      x: (t.translateX / width) * 100,
                      y: (t.translateY / height) * 100
                  };

                  // 3. Size (Scale)
                  // Figma 导出的 radial gradient 半径通常由 scale 决定
                  // 标准 SVG radial gradient r="0.5" 或 r="1"
                  // Figma 通常设 r="1"，然后用 scale 放大到像素尺寸
                  // 所以 scaleX 就是 X 轴半径(px)，scaleY 就是 Y 轴半径(px)
                  size = {
                      x: (t.scaleX / width) * 100,
                      y: (t.scaleY / height) * 100
                  };
              } else {
                  // Fallback for linear coordinates if no transform
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
      shadows: [], // SVG 很难解析阴影 (filter)，暂不支持
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
    // 确保 Solid 放在 Gradients 后面（CSS是后定义的在上，但这里的数组顺序...我们通常认为 Fills[0] 是最底层? Figma CSS 顺序：image 在上，color 在下）
    // 在 Android layer-list 中，写在下面的 item 覆盖上面的。
    // 我们这里 push 进去，渲染时 reverse() 即可。
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
