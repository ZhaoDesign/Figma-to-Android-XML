
import { FigmaLayer, PrimitiveLayer, Gradient, GradientType, ColorStop } from '../types';

/**
 * DECOMPOSER ENGINE
 *
 * Goal: Break down complex gradients into a list of simple "Primitive Layers"
 * (Ellipses/Rects with simple transforms) that can be easily rendered on any platform.
 */

let _idCounter = 0;
const uid = () => `layer_${++_idCounter}`;

const getOpacityFromColor = (color: string): number => {
    // Simple extraction, assuming rgba or hex
    if (color.startsWith('rgba')) {
        const match = color.match(/[\d.]+(?=\))/);
        return match ? parseFloat(match[0]) : 1;
    }
    return 1; // Hex usually 1 unless alpha hex
};

const normalizeColor = (color: string): string => {
    // Return rgb part, separate opacity is handled elsewhere usually
    return color;
};

/**
 * Creates a base Primitive Layer with defaults
 */
const createPrimitive = (shape: 'ellipse' | 'rect', w: number, h: number): PrimitiveLayer => ({
    id: uid(),
    shape,
    width: w,
    height: h,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    fill: {
        type: 'gradient', // Most primitives act as gradient particles
        color: '#000000',
        opacity: 1,
        blendMode: 'normal',
        blur: 0
    }
});

/**
 * Core Algorithm: Decompose a Single Gradient Fill
 */
const decomposeGradient = (gradient: Gradient, layerW: number, layerH: number, opacity: number): PrimitiveLayer[] => {
    const primitives: PrimitiveLayer[] = [];
    const t = gradient.transform || { a:1, b:0, c:0, d:1, tx:0, ty:0, rotation:0, scaleX:1, scaleY:1 };

    // 1. Normalize Matrix Transform

    const baseTransform = {
        x: t.tx,
        y: t.ty,
        rotation: t.rotation,
        scaleX: t.scaleX,
        scaleY: t.scaleY
    };

    // Constant: Large Canvas Size for Gradient Primitives
    // We use a large unit size (100 -> -50 to 50) instead of (2 -> -1 to 1).
    // This ensures that even if the matrix scale is small (e.g. scaleY=18),
    // the drawn shape (100 * 18 = 1800px) is large enough to cover the button height (e.g. 128px).
    const LARGE_CANVAS = 100;

    // 2. Decompose based on Type

    if (gradient.type === GradientType.Diamond) {
        // --- DIAMOND STRATEGY ---
        const p = createPrimitive('rect', LARGE_CANVAS, LARGE_CANVAS);

        p.transform = {
            ...baseTransform,
            rotation: baseTransform.rotation + 45
        };

        p.fill.stops = gradient.stops;
        p.fill.opacity = opacity;

        primitives.push(p);

    } else if (gradient.type === GradientType.Radial) {
        // --- RADIAL STRATEGY ---
        const p = createPrimitive('ellipse', LARGE_CANVAS, LARGE_CANVAS);
        p.transform = baseTransform;
        p.fill.stops = gradient.stops;
        p.fill.opacity = opacity;

        primitives.push(p);

    } else if (gradient.type === GradientType.Angular) {
         // --- ANGULAR STRATEGY ---
         // For Angular, we definitely want a Rect that fills the screen,
         // but using an 'ellipse' primitive shape with Sweep gradient is safer for the Generator logic
         // which expects circular/elliptical contexts for center alignment.
         // Actually, to avoid corner clipping on a sweep, a Rectangle is safer than Ellipse
         // if the aspect ratio is extreme.
         // But let's stick to Ellipse for consistency, the LARGE_CANVAS handles the size.

         const p = createPrimitive('ellipse', LARGE_CANVAS, LARGE_CANVAS);
         p.transform = baseTransform;
         p.fill.stops = gradient.stops;
         p.fill.opacity = opacity;
         (p as any).originalType = 'angular';

         primitives.push(p);

    } else {
        // --- LINEAR STRATEGY ---
        // Linear needs to extend infinitely sideways relative to the gradient vector.
        const p = createPrimitive('rect', LARGE_CANVAS, LARGE_CANVAS);
        p.transform = baseTransform;
        p.fill.stops = gradient.stops;
        p.fill.opacity = opacity;
        (p as any).originalType = 'linear';

        primitives.push(p);
    }

    return primitives;
};

/**
 * Main Entry Point: Decompose a full Figma Layer
 */
export const decomposeLayer = (layer: FigmaLayer): PrimitiveLayer[] => {
    let allPrimitives: PrimitiveLayer[] = [];

    // 1. Process Fills
    layer.fills.forEach(fill => {
        if (!fill.visible) return;

        if (fill.type === 'solid') {
            // Solid fill -> Full Size Rect Primitive (Actual Pixel Size)
            const p = createPrimitive('rect', layer.width, layer.height);
            p.transform = { x: layer.width/2, y: layer.height/2, rotation: 0, scaleX: 1, scaleY: 1 };
            p.fill.type = 'solid';
            p.fill.color = fill.value as string;
            p.fill.opacity = fill.opacity ?? 1;
            allPrimitives.push(p);
        }
        else if (fill.type === 'gradient') {
            const grad = fill.value as Gradient;
            const grads = decomposeGradient(grad, layer.width, layer.height, fill.opacity ?? 1);
            allPrimitives = allPrimitives.concat(grads);
        }
    });

    return allPrimitives;
};
