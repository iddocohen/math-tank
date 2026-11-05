/**
 * Offline play and updates (FR-051, FR-051a, research R12). main.tsx installs the service worker with `registerSW`
 * from `virtual:pwa-register` (vite-plugin-pwa, `registerType: 'prompt'`); the worker precaches the whole build, so
 * the game works offline after the first load. When a new version is waiting, it is applied (the page reloads with
 * it) only while the start screen shows, never during a round: the app reports the start screen with
 * `setStartScreen`. Without `install` (unit tests, the dev server) nothing happens.
 */

export interface RegisterOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

/** The shape of registerSW from virtual:pwa-register: returns the function that applies the waiting version. */
export type RegisterSW = (options: RegisterOptions) => (reloadPage?: boolean) => Promise<void>;

export interface SwUpdate {
  install(register: RegisterSW): void;
  setStartScreen(shown: boolean): void;
}

export function createSwUpdate(): SwUpdate {
  let update: ((reloadPage?: boolean) => Promise<void>) | null = null;
  let waiting = false;
  let onStart = false;

  const applyIfAllowed = () => {
    if (!waiting || !onStart || !update) return;
    waiting = false;
    void update(true);
  };

  return {
    install(register) {
      if (update) return;
      update = register({
        immediate: true,
        onNeedRefresh() {
          waiting = true;
          applyIfAllowed();
        },
      });
    },
    setStartScreen(shown) {
      onStart = shown;
      applyIfAllowed();
    },
  };
}

/** The app's one instance. */
export const swUpdate = createSwUpdate();
