import { describe, expect, it } from "vitest";
import {
  buildFilledAlphaMask,
  spriteMaskKey
} from "./spriteMasks";
import type { OverlayElement } from "../types/controller";

function ringRgba(
  width: number,
  height: number,
  outerR: number,
  innerR: number
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist <= outerR && dist >= innerR) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }
  return data;
}

/** Soft 1px fringe just outside a hard disc, alpha = 80. */
function discWithSoftFringe(
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dist = Math.hypot(x - cx, y - cy);
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      if (dist <= radius) {
        data[i + 3] = 255;
      } else if (dist <= radius + 1.2) {
        data[i + 3] = 80;
      }
    }
  }
  return data;
}

function centerOpaqueRatio(
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const x0 = Math.floor(width * 0.35);
  const x1 = Math.floor(width * 0.65);
  const y0 = Math.floor(height * 0.35);
  const y1 = Math.floor(height * 0.65);
  let opaque = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1;
      if (alpha[y * width + x] > 200) {
        opaque += 1;
      }
    }
  }
  return opaque / total;
}

function countOuterGrowth(
  sourceRgba: Uint8ClampedArray | Uint8Array,
  maskAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  solidThreshold = 16
): number {
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < solid.length; i += 1) {
    solid[i] = sourceRgba[i * 4 + 3] > solidThreshold ? 1 : 0;
  }

  const exterior = new Uint8Array(width * height);
  const stack: number[] = [];
  const tryPush = (index: number) => {
    if (index < 0 || index >= exterior.length || exterior[index] || solid[index]) {
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
    if (x > 0) tryPush(index - 1);
    if (x < width - 1) tryPush(index + 1);
    if (y > 0) tryPush(index - width);
    if (y < height - 1) tryPush(index + width);
  }

  let growth = 0;
  for (let i = 0; i < maskAlpha.length; i += 1) {
    // Count mask pixels that land on the true exterior (outside the source solid).
    // Soft fringe (alpha > 0 on exterior) is allowed and not counted as growth
    // when the mask only copies the original alpha there.
    if (maskAlpha[i] > 20 && exterior[i] && sourceRgba[i * 4 + 3] === 0) {
      growth += 1;
    }
  }
  return growth;
}

describe("spriteMasks", () => {
  it("spriteMaskKey is stable for mapping crops", () => {
    const element = {
      id: "Button PS5 Circle",
      type: 2,
      mapping: [305, 792, 98, 90],
      pos: [0, 0]
    } as OverlayElement;

    expect(spriteMaskKey(element)).toBe("Button PS5 Circle|305,792,98,90");
  });

  it("fills the hollow interior of a closed ring silhouette", () => {
    const width = 64;
    const height = 64;
    const rgba = ringRgba(width, height, 28, 18);
    const rawCenter = centerOpaqueRatio(
      (() => {
        const alpha = new Uint8ClampedArray(width * height);
        for (let i = 0; i < alpha.length; i += 1) {
          alpha[i] = rgba[i * 4 + 3];
        }
        return alpha;
      })(),
      width,
      height
    );

    const filled = buildFilledAlphaMask(rgba, width, height, {
      sealRadius: 0
    });
    const filledCenter = centerOpaqueRatio(filled, width, height);

    expect(rawCenter).toBeLessThan(0.15);
    expect(filledCenter).toBeGreaterThan(0.9);
    expect(countOuterGrowth(rgba, filled, width, height)).toBe(0);
  });

  it("keeps the outer edge pixel-aligned with the source alpha", () => {
    const width = 48;
    const height = 48;
    const rgba = discWithSoftFringe(width, height, 16);
    const filled = buildFilledAlphaMask(rgba, width, height, {
      sealRadius: 0
    });

    // Soft fringe alpha must be preserved exactly (no hard 255 overwrite).
    let fringeChecked = 0;
    for (let i = 0; i < width * height; i += 1) {
      const sourceA = rgba[i * 4 + 3];
      if (sourceA > 0 && sourceA < 255) {
        expect(filled[i]).toBe(sourceA);
        fringeChecked += 1;
      }
      if (sourceA > 0) {
        expect(filled[i]).toBe(sourceA);
      }
    }
    expect(fringeChecked).toBeGreaterThan(10);
    expect(countOuterGrowth(rgba, filled, width, height)).toBe(0);
  });

  it("keeps solid discs filled without eroding the silhouette away", () => {
    const width = 48;
    const height = 48;
    const rgba = ringRgba(width, height, 20, 0);
    const filled = buildFilledAlphaMask(rgba, width, height, {
      sealRadius: 0
    });

    expect(centerOpaqueRatio(filled, width, height)).toBeGreaterThan(0.95);

    let rimOpaque = 0;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
      const x = Math.round(23.5 + Math.cos(angle) * 18);
      const y = Math.round(23.5 + Math.sin(angle) * 18);
      if (filled[y * width + x] > 200) {
        rimOpaque += 1;
      }
    }
    expect(rimOpaque).toBeGreaterThan(20);
    expect(countOuterGrowth(rgba, filled, width, height)).toBe(0);
  });

  it("returns an empty buffer for zero-sized crops", () => {
    expect(buildFilledAlphaMask(new Uint8ClampedArray(0), 0, 0).length).toBe(0);
  });
});
