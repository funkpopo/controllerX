import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import type { DisplayDevice } from "../data/displayDevice";
import type { AppSettings, ProfileInfo } from "../types/controller";

type SettingsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; settings: AppSettings; profiles: ProfileInfo[] }
  | { kind: "error"; error: string };

export function useAppSettings() {
  const [state, setState] = useState<SettingsLoadState>({ kind: "loading" });

  useEffect(() => {
    let disposed = false;

    Promise.all([
      invoke<AppSettings>("get_settings"),
      invoke<ProfileInfo[]>("get_profile_catalog")
    ])
      .then(([settings, profiles]) => {
        if (!disposed) {
          setState({ kind: "ready", settings, profiles });
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setState({ kind: "error", error: String(error) });
        }
      });

    // Listen for settings updates from the tray menu
    const unlistenPromise = listen<AppSettings>("settings-updated", (event) => {
      if (!disposed) {
        setState((current) =>
          current.kind === "ready"
            ? { ...current, settings: event.payload }
            : current
        );
      }
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const applySettings = useCallback(async (nextSettings: AppSettings) => {
    const settings = await invoke<AppSettings>("update_settings", {
      nextSettings
    });

    setState((current) =>
      current.kind === "ready" ? { ...current, settings } : current
    );
  }, []);

  const updateSettings = useCallback(
    async (edit: (settings: AppSettings) => AppSettings) => {
      if (state.kind !== "ready") {
        throw new Error("Settings are not loaded.");
      }

      await applySettings(edit(structuredClone(state.settings)));
    },
    [applySettings, state]
  );

  const setClickThrough = useCallback(async (enabled: boolean) => {
    const settings = await invoke<AppSettings>("set_click_through", { enabled });
    setState((current) =>
      current.kind === "ready" ? { ...current, settings } : current
    );
  }, []);

  const setLockPosition = useCallback(async (enabled: boolean) => {
    const settings = await invoke<AppSettings>("set_lock_position", { enabled });
    setState((current) =>
      current.kind === "ready" ? { ...current, settings } : current
    );
  }, []);

  const setOverlaySize = useCallback(
    async (size: "compact" | "standard" | "large") => {
      const settings = await invoke<AppSettings>("set_overlay_size", { size });
      setState((current) =>
        current.kind === "ready" ? { ...current, settings } : current
      );
    },
    []
  );

  const setDisplayDeviceWindowSize = useCallback(
    async (displayDevice: DisplayDevice) => {
      const settings = await invoke<AppSettings>("set_display_device_window_size", {
        displayDevice
      });
      setState((current) =>
        current.kind === "ready" ? { ...current, settings } : current
      );
    },
    []
  );

  return {
    state,
    applySettings,
    updateSettings,
    setClickThrough,
    setLockPosition,
    setOverlaySize,
    setDisplayDeviceWindowSize
  };
}
