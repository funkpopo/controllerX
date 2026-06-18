import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  DPAD_DIRECTIONS,
  dpadDirectionForElement,
  getElementRenderState,
  getDpadDirectionRenderState,
  isElementActive,
  shouldClipSharedDpadDirectionElement,
  shouldRenderElement,
  validateOverlayPresetElements,
  type DpadDirection,
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
  debugVisible: boolean;
};

type SpriteStyle = CSSProperties & Record<`--${string}`, string>;

export function ControllerOverlay({
  preset,
  controller,
  opacity,
  debugVisible
}: ControllerOverlayProps) {
  const [loadedPreset, setLoadedPreset] = useState<LoadedOverlayPreset | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const fitRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

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

        validateOverlayPresetElements(preset.id, file.elements);

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
    const node = fitRef.current;
    if (!node || !loadedPreset) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });

    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [loadedPreset]);

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
    return <div className="state-panel">预设加载失败:{error}</div>;
  }

  if (!loadedPreset) {
    return <div className="state-panel">正在加载预设</div>;
  }

  const aspect = loadedPreset.overlayWidth / loadedPreset.overlayHeight;
  const availableWidth = box.width || loadedPreset.overlayWidth;
  const availableHeight = box.height || loadedPreset.overlayHeight;
  const renderedWidth = Math.max(
    1,
    Math.min(loadedPreset.overlayWidth, availableWidth, availableHeight * aspect)
  );
  const renderedHeight = renderedWidth / aspect;
  const stageScale = renderedWidth / loadedPreset.overlayWidth;

  return (
    <div className="overlay-shell" ref={fitRef} style={{ opacity }}>
      <div
        className="overlay-stage-viewport"
        style={{
          width: `${renderedWidth}px`,
          height: `${renderedHeight}px`
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
          {elements.map(({ element, renderState }) =>
            element.type === 8 ? (
              <DpadSpriteLayers
                key={`${element.id}-${element.type}-${element.mapping.join("-")}`}
                image={loadedPreset.image}
                element={element}
                controller={controller}
              />
            ) : (
              <SpriteLayer
                key={`${element.id}-${element.type}-${element.mapping.join("-")}`}
                image={loadedPreset.image}
                element={element}
                renderState={renderState}
                clipPath={sharedDpadDirectionClipPath(element, loadedPreset.elements)}
                dataDirection={sharedDpadDirection(element, loadedPreset.elements)}
              />
            )
          )}
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

function DpadSpriteLayers({
  image,
  element,
  controller
}: {
  image: string;
  element: OverlayElement;
  controller: ControllerSnapshot;
}) {
  return (
    <>
      {DPAD_DIRECTIONS.map((direction) => (
        <SpriteLayer
          key={`${element.id}-${direction}`}
          image={image}
          element={element}
          renderState={getDpadDirectionRenderState(direction, controller)}
          className={`sprite-dpad-${direction}`}
          clipPath={dpadDirectionClipPath(direction)}
          dataDirection={direction}
        />
      ))}
    </>
  );
}

function SpriteLayer({
  image,
  element,
  renderState,
  className,
  clipPath,
  dataDirection
}: {
  image: string;
  element: OverlayElement;
  renderState: ElementRenderState;
  className?: string;
  clipPath?: string;
  dataDirection?: string;
}) {
  const [sourceX, sourceY, width, height] = element.mapping;
  const [left, top] = element.pos;
  const dpadDirection = dpadDirectionForElement(element);

  if (!shouldRenderElement(element, renderState)) {
    return null;
  }

  const active = isElementActive(element, renderState);
  const overlayOpacity =
    element.type === 0 ? 1 : Math.min(1, 0.42 + renderState.value * 0.58);
  const resolvedClipPath =
    clipPath ??
    (renderState.clipRatio === null
      ? null
      : `inset(${Math.max(0, 1 - renderState.clipRatio) * 100}% 0 0 0)`);
  const clipStyle = resolvedClipPath === null ? {} : { clipPath: resolvedClipPath };

  const style = {
    left,
    top,
    width,
    height,
    opacity: overlayOpacity,
    backgroundImage: `url("${image}")`,
    backgroundPosition: `-${sourceX}px -${sourceY}px`,
    transform: `translate(${renderState.x}px, ${renderState.y}px)`,
    "--sprite-image": `url("${image}")`,
    "--sprite-mask-position": `-${sourceX}px -${sourceY}px`,
    "--sprite-active-strength": `${Math.min(1, Math.max(0, renderState.value))}`,
    ...clipStyle
  } satisfies SpriteStyle;

  return (
    <div
      className={[
        "sprite-layer",
        `sprite-type-${element.type}`,
        elementClassName(element),
        dpadDirection ? `sprite-dpad-${dpadDirection}` : "",
        className,
        active ? "sprite-active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-active={active ? "true" : "false"}
      data-direction={dataDirection}
      style={style}
    />
  );
}

function dpadDirectionClipPath(direction: DpadDirection) {
  switch (direction) {
    case "up":
      return "inset(0 33% 50% 33%)";
    case "down":
      return "inset(50% 33% 0 33%)";
    case "left":
      return "inset(33% 50% 33% 0)";
    case "right":
      return "inset(33% 0 33% 50%)";
  }
}

function sharedDpadDirection(
  element: OverlayElement,
  elements: OverlayElement[]
) {
  if (!shouldClipSharedDpadDirectionElement(element, elements)) {
    return undefined;
  }

  return dpadDirectionForElement(element) ?? undefined;
}

function sharedDpadDirectionClipPath(
  element: OverlayElement,
  elements: OverlayElement[]
) {
  const direction = sharedDpadDirection(element, elements);
  return direction ? dpadDirectionClipPath(direction) : undefined;
}

function elementClassName(element: OverlayElement) {
  const normalizedId = element.id.toLowerCase();

  if (element.type === 2 && ["a", "b", "x", "y"].includes(normalizedId)) {
    return `sprite-button-${normalizedId}`;
  }

  return "";
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
