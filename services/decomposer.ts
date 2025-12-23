
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
    // We want to transform the Unit Square (0,0 -> 1,1) or Unit Center (-0.5 -> 0.5) to Pixel Space.
    // Figma Matrix is typically defined relative to the layer bounds.

    const baseTransform = {
        x: t.tx,
        y: t.ty,
        rotation: t.rotation,
        scaleX: t.scaleX,
        scaleY: t.scaleY
    };

    // 2. Decompose based on Type

    if (gradient.type === GradientType.Diamond) {
        // --- DIAMOND STRATEGY ---
        // A diamond is just a Rectangle rotated 45 degrees relative to the gradient transform.
        // We use a Rect primitive.

        const p = createPrimitive('rect', 2, 2); // Unit box size 2 (-1 to 1)

        // Combine rotations: Gradient Rotation + 45 deg
        p.transform = {
            ...baseTransform,
            rotation: baseTransform.rotation + 45
        };

        // Diamond scaling: usually 0.707 (1/sqrt(2)) relative to the axis to fit
        // But Figma's matrix for diamond usually handles the scale.
        // We map the stops to the primitive.
        p.fill.stops = gradient.stops;
        p.fill.opacity = opacity;

        primitives.push(p);

    } else if (gradient.type === GradientType.Radial) {
        // --- RADIAL STRATEGY ---
        // Map to a single Ellipse Primitive.
        // The "Blur" is implicitly handled by the Radial Gradient of the primitive itself.
        // For complex multi-stop radial gradients (iso-bands), we could split into multiple ellipses,
        // but for standard Android XML, a single Radial Gradient Primitive with stops is most efficient
        // and provides 100% fidelity if the Matrix is correct.

        const p = createPrimitive('ellipse', 2, 2); // Unit circle (-1 to 1)
        p.transform = baseTransform;
        p.fill.stops = gradient.stops;
        p.fill.opacity = opacity;

        primitives.push(p);

    } else if (gradient.type === GradientType.Angular) {
         // --- ANGULAR STRATEGY ---
         // Angular is mapped to an Ellipse primitive but with a "Sweep" fill type.
         // Note: If we strictly followed the "Primitives only have Radial/Linear" rule,
         // we would decompose this into angular sectors (Rects/Ellipses).
         // However, Android supports Sweep Gradient natively.
         // To stay true to the "Intermediate Graph" concept, we label this as an Ellipse shape
         // but we mark the fill type specifically.

         const p = createPrimitive('ellipse', 2, 2);
         p.transform = baseTransform;
         p.fill.stops = gradient.stops;
         p.fill.opacity = opacity;
         // Special marker (or we could add 'conic' to primitive fill types)
         // For now, we pass stops and let the renderer decide based on GradientType which we attach
         (p as any).originalType = 'angular';

         primitives.push(p);

    } else {
        // --- LINEAR STRATEGY ---
        // Linear is a Rect Primitive.
        // Defined from -1 to 1 on X axis.

        const p = createPrimitive('rect', 2, 2);
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
            // Solid fill -> Full Size Rect Primitive
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

    // 2. Optimization Step (Simple merge for now)
    // In a real pipeline, we would merge overlapping layers with same color/transform

    return allPrimitives;
};
