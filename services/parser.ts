
import { FigmaLayer, Fill, Gradient, GradientType, ColorStop } from '../types';

// Fix: Corrected matrix multiplication logic for 2D affine transformations
const multiply = (m1: any, m2: any) => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
  ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
});

const parseTransform = (str: string) => {
  let res = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const reg = /(\w+)\(([^)]+)\)/g;
  let m;
  while ((m = reg.exec(str)) !== null) {
    const type = m[1];
    const args = m[2].split(/[\s,]+/).map(parseFloat);
    let cur = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    if (type === 'matrix') {
      cur = { a: args[0], b: args[1], c: args[2], d: args[3], tx: args[4], ty: args[5] };
    } else if (type === 'translate') {
      cur.tx = args[0]; cur.ty = args[1] || 0;
    } else if (type === 'rotate') {
      const rad = (args[0] * Math.PI) / 180;
      cur.a = Math.cos(rad); cur.b = Math.sin(rad);
      cur.c = -Math.sin(rad); cur.d = Math.cos(rad);
    } else if (type === 'scale') {
      cur.a = args[0]; cur.d = args[1] === undefined ? args[0] : args[1];
    }
    res = multiply(res, cur);
  }
  return res;
};

export const parseClipboardData = (svgText: string): FigmaLayer | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(parseFloat) || [0, 0, 296, 48];
  const defs = doc.querySelector('defs');
  const fills: Fill[] = [];

  doc.querySelectorAll('path').forEach(path => {
    const fillUrl = path.getAttribute('fill');
    if (!fillUrl?.startsWith('url(#')) return;
    
    const id = fillUrl.replace(/url\(#([^)]+)\)/, '$1');
    const gEl = defs?.querySelector(`#${id}`);
    if (!gEl) return;

    const isRadial = gEl.tagName === 'radialGradient';
    const stops: ColorStop[] = Array.from(gEl.querySelectorAll('stop')).map(s => ({
      color: s.getAttribute('stop-color') || '#000',
      position: parseFloat(s.getAttribute('offset') || '0') * 100,
      opacity: s.getAttribute('stop-opacity') ? parseFloat(s.getAttribute('stop-opacity')!) : 1
    }));

    let grad: Gradient;
    if (isRadial) {
      const trans = parseTransform(gEl.getAttribute('gradientTransform') || '');
      grad = {
        type: GradientType.Radial,
        stops,
        transform: {
          ...trans,
          rotation: Math.atan2(trans.b, trans.a) * 180 / Math.PI,
          scaleX: Math.sqrt(trans.a * trans.a + trans.b * trans.b),
          scaleY: Math.sqrt(trans.c * trans.c + trans.d * trans.d)
        }
      };
    } else {
      grad = {
        type: GradientType.Linear,
        stops,
        coords: {
          x1: parseFloat(gEl.getAttribute('x1') || '0'),
          y1: parseFloat(gEl.getAttribute('y1') || '0'),
          x2: parseFloat(gEl.getAttribute('x2') || '0'),
          y2: parseFloat(gEl.getAttribute('y2') || '0'),
        }
      };
    }

    fills.push({
      type: 'gradient',
      visible: true,
      value: grad,
      pathData: path.getAttribute('d') || ''
    });
  });

  return {
    name: 'Imported Shape',
    width: viewBox[2],
    height: viewBox[3],
    fills,
    corners: viewBox[3] / 2,
    shadows: [],
    opacity: 1
  };
};
