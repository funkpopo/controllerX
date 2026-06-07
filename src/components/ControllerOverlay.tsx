import { useEffect, useMemo, useRef, useState } from "react";
import {
  getElementRenderState,
  shouldRenderElement,
  type ElementRenderState
} from "../data/overlayMapping";
import type {
  ControllerSnapshot,
  LoadedOverlayPreset,
  OverlayElement,
  OverlayPreset,
  OverlayPresetFile
} from "../types/controller";

type ControllerOverlayProps = {
  preset: OverlayPreset;
  controller: ControllerSnapshot;
  opacity: number;
  scale: number;
  debugVisible: boolean;
};

export function ControllerOverlay({
  preset,
  controller,
  opacity,
  scale,
  debugVisible
}: ControllerOverlayProps) {
  const [loadedPreset, setLoadedPreset] = useState<LoadedOverlayPreset | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    let disposed = false;

    setError(null);
    fetch(preset.config)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<OverlayPresetFile>;
      })
      .then((file) => {
        if (disposed) {
          return;
        }

        const body = file.elements.find((element) => element.type === 0);
        if (!body && (!file.overlay_width || !file.overlay_height)) {
          throw new Error(`Preset '${preset.id}' has no body layer.`);
        }

        setLoadedPreset({
          ...preset,
          overlayWidth: file.overlay_width ?? body!.mapping[2],
          overlayHeight: file.overlay_height ?? body!.mapping[3],
          elements: [...file.elements].sort(sortOverlayElements)
        });
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setLoadedPreset(null);
          setError(String(reason));
        }
      });

    return () => {
      disposed = true;
    };
  }, [preset]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || !loadedPreset) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setStageScale((width / loadedPreset.overlayWidth) * scale);
    });

    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [loadedPreset, scale]);

  const elements = useMemo(() => {
    if (!loadedPreset) {
      return [];
    }

    return loadedPreset.elements.map((element) => ({
      element,
      renderState: getElementRenderState(element, controller)
    }));
  }, [controller, loadedPreset]);

  if (error) {
    return <div className="state-panel">Preset load failed: {error}</div>;
  }

  if (!loadedPreset) {
    return <div className="state-panel">Loading preset</div>;
  }

  return (
    <div
      className="overlay-shell"
      style={{
        opacity,
        maxWidth: `${loadedPreset.overlayWidth * scale}px`
      }}
    >
      <div
        className="overlay-stage-viewport"
        ref={stageRef}
        style={{
          aspectRatio: `${loadedPreset.overlayWidth} / ${loadedPreset.overlayHeight}`
        }}
      >
        <div
          className="overlay-stage"
          style={{
            width: `${loadedPreset.overlayWidth}px`,
            height: `${loadedPreset.overlayHeight}px`,
            transform: `scale(${stageScale})`
          }}
        >
          {elements.map(({ element, renderState }) => (
            <SpriteLayer
              key={`${element.id}-${element.type}-${element.mapping.join("-")}`}
              image={loadedPreset.image}
              element={element}
              renderState={renderState}
            />
          ))}
          {debugVisible
            ? elements
                .filter(({ element }) => element.type !== 0)
                .map(({ element, renderState }) => (
                  <DebugLabel
                    key={`debug-${element.id}-${element.mapping.join("-")}`}
                    element={element}
                    renderState={renderState}
                  />
                ))
            : null}
        </div>
      </div>
    </div>
  );
}

function SpriteLayer({
  image,
  element,
  renderState
}: {
  image: string;
  element: OverlayElement;
  renderState: ElementRenderState;
}) {
  const [sourceX, sourceY, width, height] = element.mapping;
  const [left, top] = element.pos;

  if (!shouldRenderElement(element, renderState)) {
    return null;
  }

  const overlayOpacity =
    element.type === 0 ? 1 : Math.min(1, 0.26 + renderState.value * 0.74);
  const clipStyle =
    renderState.clipRatio === null
      ? {}
      : {
          clipPath: `inset(${Math.max(0, 1 - renderState.clipRatio) * 100}% 0 0 0)`
        };

  return (
    <div
      className={`sprite-layer sprite-type-${element.type}`}
      style={{
        left,
        top,
        width,
        height,
        opacity: overlayOpacity,
        backgroundImage: `url("${image}")`,
        backgroundPosition: `-${sourceX}px -${sourceY}px`,
        transform: `translate(${renderState.x}px, ${renderState.y}px)`,
        ...clipStyle
      }}
    />
  );
}

function DebugLabel({
  element,
  renderState
}: {
  element: OverlayElement;
  renderState: ElementRenderState;
}) {
  const [, , width] = element.mapping;
  const [left, top] = element.pos;
  const active = Math.abs(renderState.value) > 0.01;

  return (
    <div
      className={`overlay-debug-label ${active ? "active" : ""}`}
      style={{
        left: left + width * 0.5,
        top
      }}
    >
      <span>{element.id}</span>
      <strong>{renderState.value.toFixed(2)}</strong>
    </div>
  );
}

function sortOverlayElements(left: OverlayElement, right: OverlayElement) {
  const leftZ = Number(left.z_level ?? 0);
  const rightZ = Number(right.z_level ?? 0);
  return leftZ - rightZ;
}
