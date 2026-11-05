/**
 * Offline play and updates (FR-051, FR-051a, research R12). main.tsx installs the service worker with `registerSW`
 * from `virtual:pwa-register` (vite-plugin-pwa, `registerType: 'prompt'`); the worker precaches the whole build, so
 * the game works offline after the first load. When a new version is waiting, it is applied (the page reloads with
 * it) only while the start screen shows, never during a round: the app reports the start screen with
 * `setStartScreen`. Without `install` (unit tests, the dev server) nothing happens.
 */

/**
 * Whether a waiting version may reload the page now (FR-051a, review R2): only on the start screen, and never while the
 * parent menu, the settings or progress page or the transfer dialog is open, so no unsaved setting or pending take-over
 * is lost.
 */
export function canApplyUpdate(view: { screen: string; parentOpen: boolean; transferOpen: boolean }): boolean {
  return view.screen === 'start' && !view.parentOpen && !view.transferOpen;
}

export interface RegisterOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
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
    // Review L4: a failed update (for example offline) waits for the next time the start screen shows.
    update(true).catch(() => {
      waiting = true;
    });
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
        onRegisterError(error) {
          // The game still works from the network; offline play and updates wait for the next load (review L4).
          console.warn('Service worker registration failed', error);
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
