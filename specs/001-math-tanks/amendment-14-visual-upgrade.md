# Amendment 14: nicer tanks, terrain and effects, compatible with the garage

**Date**: 2026-11-05
**Requested by**: the product owner asked whether the tanks and terrain could look better without too much complexity, and whether it fits the garage (amendment 11); they accepted the hybrid proposal: code-drawn tanks and effects plus one CC0 ground texture.

## Sources considered

- Kenney "Tank pack (80+)", CC0, side view: https://opengameart.org/content/tank-pack-80 . Not used: military look, and garage flags and hats would need refitting to every sprite.
- CC0 tileable ground textures on OpenGameArt: https://opengameart.org/node/84103 (hand-painted grass, dirt, sand, pavement, 512x512), https://opengameart.org/content/tileable-dirt-textures , https://opengameart.org/content/tileable-grass-textures-set-2 , https://opengameart.org/node/69941 . One dirt texture is bundled; its license is checked on its OpenGameArt page before use, and if no texture with a clear CC0 license can be downloaded, the dirt fill is generated in code (noise pattern) instead.

The style stays original; it does not copy the look of any existing game.

## Behavior

1. **Terrain.**
   - Dirt fill uses one tileable CC0 texture (or a code-generated noise texture as fallback), cut to the hill outline, so craters cut it automatically. Bundled locally; offline play unchanged.
   - Thicker grass edge with small tufts; darker soil layers lower down; a few pebbles.
   - Two layers of distant hills in soft colors and a sun behind the battlefield, for depth. They never change during a round except with a new landscape.
   - Crater edges darkened (scorched) so misses leave a visible mark.
2. **Tanks (drawn in code).**
   - Rounded body with a highlight on top and a shadow band below, both computed from the tank's color (lighter and darker shade), so every garage color gets the same quality automatically.
   - Wheels turn while the tank settles on new ground; a small dust puff when it lands.
   - On firing: short barrel recoil, a white muzzle flash and a grey smoke puff (neutral colors, so garage shell trails stay visible).
   - The child's tank stays blue-ish with its flag and hat; the enemy and decoys stay red, angular, with a black flag (amendment 05 item 6).
3. **Garage compatibility.**
   - The anchor points for the antenna (flag) and the turret top (hat) do not move; flags and hats move with the body when it lands or settles.
   - The garage preview uses the same drawing code as the battle.
   - Shell trails are drawn a bit thicker (the product owner noticed the thin trail).
4. **Effects.** Explosion debris in the ground's colors; a tiny screen shake (2 to 3 px, under 200 ms) on a hit on any tank; a drawn "boom" ring. Effects respect a reduced-motion preference of the operating system (no shake, fewer particles).
5. **Credits.** The README and the settings page name the texture author and link its page, even though CC0 does not require it.
6. **Performance.** Smooth animation stays required (SC-002): at least 30 frames per second on a 2020 or later tablet; the texture is drawn once per landscape change and crater, not every frame.
7. **Tests and checks.** Unit tests for the shade computation (every garage color keeps clear contrast to the red enemy and to the ground) and for unchanged anchor points; muted headless screenshots of all 13 garage items in the preview and in battle, of a fresh landscape, and of a landscape with several craters.
