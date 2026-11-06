# Amendment 13: the enemy zeroes in on repeated misses, and new hills after every destroyed enemy

**Date**: 2026-11-05
**Requested by**: the product owner: "The enemy AI is too simple in the sense he never hits my tank no matter how many times I miss. My child will explore that and just guess all the time, how can this be fixed? Also the terrain after a while does not exist, does it make sense to regenerate the terrain after the enemy has died?"
**Changes**: [amendment 07](./amendment-07-visible-enemy-return-fire.md) items 5 and 6 (deliberate near misses and seeded random hits by difficulty). PRD section 8 says the AI must not exploit the child's mathematics difficulties; the product owner decided that repeated misses (guessing) should have a visible consequence. Help still reaches the shown solution at step 3, so a child who stops guessing can always avoid losing a heart.

## Decisions (answers)

- The enemy zeroes in visibly on consecutive misses; random hits are removed.
- A new landscape after every destroyed enemy.

## Behavior

1. **Miss streak.** The game counts the child's consecutive misses (any shot that does not destroy the enemy, including near misses and decoy hits). An exact hit on the enemy, or firing at the shown solution at help step 3, resets the streak to 0. "Neue Landschaft" does not reset it, so a refresh is not a way around it.
2. **Fast guesses count double.** A miss confirmed less than 1.5 seconds after answers became possible, or after 3 or more wrong answers within 5 seconds (the FR-038 guess rule), adds 2 to the streak instead of 1.
3. **Zeroing in.** The enemy still fires after every shot that does not destroy it (amendment 07 item 4). Its shell lands beside the child's tank at a distance that shrinks with the streak: streak 1 about 100 world units, 2 about 60, 3 about 30 (always outside the hit area until it hits), on a random side.
4. **When it hits.** The enemy's shot hits (one heart) when the streak reaches the difficulty's limit: "Leicht" 4, "Normal" 3, "Herausfordernd" 2. After a hit the streak resets to 0, so the next misses start far away again.
5. **No random hits.** The per-shot random hit chance of amendment 07 is removed; the first enemy shot of a round still always misses (it can only hit at a streak of at least 2 anyway). The enemy's behavior depends only on the miss streak, never on help use as such.
6. **Visible.** The child sees the shells come closer. On the second-to-last miss before a hit (streak = limit − 1), the child's tank shows a short "warning" wobble and the hearts pulse once, with no text.
7. **New landscape after every destroyed enemy.** When the enemy is destroyed, after its explosion, the hills fade to a new landscape (new terrain seed, about 0.5 to 1 s transition), the child's tank settles on the new ground on the same side, and the next enemy appears. Hearts, the destroyed-tank counter, the time, the round type progress and records continue. The ruler does not change. This also keeps craters from wearing the ground down to the bedrock strip.
8. No-damage mode: the zeroing-in is still shown, but hits take no heart.
