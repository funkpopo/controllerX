import type { OverlayElement } from "../types/controller";

export type FilledSpriteMask = {
  dataUrl: string;
  width: number;
  height: number;
};

export type FilledSpriteMaskMap = Record<string, FilledSpriteMask>;

/** Pixels above this alpha count as solid when detecting enclosed holes. */
const HOLE_SOLID_THRESHOLD = 16;
/**
 * Default seal radius is 0 so the outer contour never grows.
 * Outer edge always copies the original alpha; only true interior holes are filled.
 */
const HOLE_SEAL_RADIUS = 0;

/**
 * Stable key for a sprite crop so React layers can look up a precomputed
 * filled silhouette without depending on object identity.
 */
export function spriteMaskKey(element: OverlayElement): string {
  return `${element.id}|${element.mapping.join(",")}`;
}

/**
 * Build filled highlight masks for every non-body overlay element.
 *
 * Many controller sprites (especially DualSense face buttons / d-pad / shoulders)
 * are hollow outlines. Masking the active tint with that alpha only lights the
 * ring. We flood-fill true interior holes and export a solid mask so the interior
 * lights up, while the outer edge stays pixel-aligned to the original sprite.
 */
export async function buildFilledSpriteMasks(
  imageUrl: string,
  elements: OverlayElement[]
): Promise<FilledSpriteMaskMap> {
  const targets = elements.filter((element) => element.type !== 0);
  if (targets.length === 0) {
    return {};
  }

  const image = await loadImage(imageUrl);
  const map: FilledSpriteMaskMap = {};

  for (const element of targets) {
    const [sourceX, sourceY, width, height] = element.mapping;
    if (width <= 0 || height <= 0) {
      continue;
    }

    const rgba = sampleSpriteRgba(image, sourceX, sourceY, width, height);
    const filledAlpha = buildFilledAlphaMask(rgba, width, height);
    const dataUrl = alphaMaskToDataUrl(filledAlpha, width, height);
    map[spriteMaskKey(element)] = { dataUrl, width, height };
  }

  return map;
}

/**
 * Edge-exact hole fill:
 * - Outer silhouette = original sprite alpha (soft AA preserved, no grow/shrink)
 * - Interior = pixels enclosed by the silhouette (not reachable from the crop border)
 *
 * Unlike dilate→fill→erode, this never redraws the outer contour, so the highlight
 * stays flush with the button art.
 */
export function buildFilledAlphaMask(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options?: {
    alphaThreshold?: number;
    /** @deprecated Use sealRadius. Kept for tests / callers. */
    closeRadius?: number;
    sealRadius?: number;
  }
): Uint8ClampedArray {
  if (width <= 0 || height <= 0) {
    return new Uint8ClampedArray(0);
  }

  const threshold = options?.alphaThreshold ?? HOLE_SOLID_THRESHOLD;
  const sealRadius =
    options?.sealRadius ?? options?.closeRadius ?? HOLE_SEAL_RADIUS;

  const alpha = new Uint8ClampedArray(width * height);
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < solid.length; i += 1) {
    const a = rgba[i * 4 + 3];
    alpha[i] = a;
    solid[i] = a > threshold ? 1 : 0;
  }

  // Seal only for hole detection (tiny gaps in outline AA). The exported outer
  // edge still uses the original alpha bytes, never the sealed binary.
  const sealed =
    sealRadius > 0
      ? erodeBinary(dilateBinary(solid, width, height, sealRadius), width, height, sealRadius)
      : solid;
  const filled = fillBinaryHoles(sealed, width, height);

  const out = new Uint8ClampedArray(width * height);
  for (let i = 0; i < out.length; i += 1) {
    if (alpha[i] > 0) {
      // Exact outer (and glyph) edge from the source sprite.
      out[i] = alpha[i];
    } else if (filled[i]) {
      // True interior only — not reachable from the crop border.
      out[i] = 255;
    } else {
      out[i] = 0;
    }
  }

  return out;
}

function dilateBinary(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  return morphBinary(src, width, height, radius, true);
}

function erodeBinary(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  return morphBinary(src, width, height, radius, false);
}

/** Separable square morphological dilate/erode (two 1D passes). */
function morphBinary(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
  dilate: boolean
): Uint8Array {
  if (radius <= 0) {
    return src.slice();
  }

  const tmp = new Uint8Array(width * height);
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = dilate ? 0 : 1;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      for (let xx = x0; xx <= x1; xx += 1) {
        const sample = src[y * width + xx];
        if (dilate) {
          if (sample) {
            value = 1;
            break;
          }
        } else if (!sample) {
          value = 0;
          break;
        }
      }
      tmp[y * width + x] = value;
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let value = dilate ? 0 : 1;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      for (let yy = y0; yy <= y1; yy += 1) {
        const sample = tmp[yy * width + x];
        if (dilate) {
          if (sample) {
            value = 1;
            break;
          }
        } else if (!sample) {
          value = 0;
          break;
        }
      }
      out[y * width + x] = value;
    }
  }

  return out;
}

function fillBinaryHoles(
  solid: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const exterior = new Uint8Array(width * height);
  const stack: number[] = [];

  const tryPush = (index: number) => {
    if (index < 0 || index >= exterior.length) {
      return;
    }
    if (exterior[index] || solid[index]) {
      return;
    }
    exterior[index] = 1;
    stack.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }

  while (stack.length > 0) {
    const index = stack.pop()!;
    const x = index % width;
    const y = (index / width) | 0;
    if (x > 0) {
      tryPush(index - 1);
    }
    if (x < width - 1) {
      tryPush(index + 1);
    }
    if (y > 0) {
      tryPush(index - width);
    }
    if (y < height - 1) {
      tryPush(index + width);
    }
  }

  const filled = new Uint8Array(width * height);
  for (let i = 0; i < filled.length; i += 1) {
    filled[i] = exterior[i] ? 0 : 1;
  }
  return filled;
}

function sampleSpriteRgba(
  image: CanvasImageSource & { width: number; height: number },
  sourceX: number,
  sourceY: number,
  width: number,
  height: number
): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return new Uint8ClampedArray(width * height * 4);
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, sourceX, sourceY, width, height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function alphaMaskToDataUrl(
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i += 1) {
    const offset = i * 4;
    // White RGB; highlight colour is applied via CSS background.
    imageData.data[offset] = 255;
    imageData.data[offset + 1] = 255;
    imageData.data[offset + 2] = 255;
    imageData.data[offset + 3] = alpha[i];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(
  url: string
): Promise<HTMLImageElement & { width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load sprite image: ${url}`));
    image.src = url;
  });
}
