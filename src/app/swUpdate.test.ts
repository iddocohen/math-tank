import { describe, expect, it, vi } from 'vitest';
import { canApplyUpdate, createSwUpdate, type RegisterSW } from './swUpdate';

/** A stand-in for registerSW from virtual:pwa-register: remembers the callbacks and counts updates. */
function fakeRegister() {
  const calls = { update: 0, reload: [] as Array<boolean | undefined> };
  let needRefresh: (() => void) | undefined;
  const register: RegisterSW = (options) => {
    needRefresh = options.onNeedRefresh;
    return async (reload?: boolean) => {
      calls.update++;
      calls.reload.push(reload);
    };
  };
  return { register, calls, newVersion: () => needRefresh?.() };
}

describe('service worker update (FR-051, FR-051a, research R12)', () => {
  it('registers the service worker once with the prompt callbacks', () => {
    const register = vi.fn<RegisterSW>(() => async () => {});
    const sw = createSwUpdate();
    sw.install(register);
    sw.install(register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]![0]).toMatchObject({ immediate: true });
  });

  it('applies a waiting version at once while the start screen shows', () => {
    const f = fakeRegister();
    const sw = createSwUpdate();
    sw.install(f.register);
    sw.setStartScreen(true);
    f.newVersion();
    expect(f.calls.update).toBe(1);
    expect(f.calls.reload).toEqual([true]);
  });

  it('never applies it during a round: it waits until the start screen shows again', () => {
    const f = fakeRegister();
    const sw = createSwUpdate();
    sw.install(f.register);
    sw.setStartScreen(false);
    f.newVersion();
    expect(f.calls.update).toBe(0);
    sw.setStartScreen(false);
    expect(f.calls.update).toBe(0);
    sw.setStartScreen(true);
    expect(f.calls.update).toBe(1);
    // Applied once only.
    sw.setStartScreen(false);
    sw.setStartScreen(true);
    expect(f.calls.update).toBe(1);
  });

  it('does nothing before install, for example in unit tests of the app', () => {
    const sw = createSwUpdate();
    expect(() => sw.setStartScreen(true)).not.toThrow();
  });
});

describe('canApplyUpdate (review R2)', () => {
  it('allows the reload only on the start screen with no parent screen and no transfer dialog open', () => {
    expect(canApplyUpdate({ screen: 'start', parentOpen: false, transferOpen: false })).toBe(true);
    expect(canApplyUpdate({ screen: 'battle', parentOpen: false, transferOpen: false })).toBe(false);
    expect(canApplyUpdate({ screen: 'garage', parentOpen: false, transferOpen: false })).toBe(false);
    expect(canApplyUpdate({ screen: 'start', parentOpen: true, transferOpen: false })).toBe(false);
    expect(canApplyUpdate({ screen: 'start', parentOpen: false, transferOpen: true })).toBe(false);
  });

  it('a failed update is tried again the next time the start screen shows, without an unhandled rejection (review L4)', async () => {
    let fail = true;
    let needRefresh: (() => void) | undefined;
    let calls = 0;
    const register: RegisterSW = (options) => {
      needRefresh = options.onNeedRefresh;
      expect(options.onRegisterError).toBeTypeOf('function');
      return () => {
        calls++;
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
      };
    };
    const sw = createSwUpdate();
    sw.install(register);
    sw.setStartScreen(true);
    needRefresh?.();
    await Promise.resolve();
    await Promise.resolve();
    fail = false;
    sw.setStartScreen(false);
    sw.setStartScreen(true);
    expect(calls).toBe(2);
  });
});
