/**
 * No German text outside the translation table (T151, FR-056). Scans the screens (`src/app/**\/*.tsx`) and the
 * battlefield (`src/game/**\/*.ts`) for string literals and JSX text that look German: letters ä, ö, ü, ß, or words
 * from a short list. Comments and test files are not checked. Every child- or parent-facing text belongs in
 * src/i18n/de.ts.
 */
import { describe, expect, it } from 'vitest';

/** The source files, read as text by Vite (no Node.js types needed). */
const SOURCES = import.meta.glob<string>(['../app/**/*.tsx', '../game/**/*.ts', '!**/*.test.ts', '!**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const UMLAUT = /[äöüÄÖÜß]/;
/** Common words of the game's German interface that have no umlaut. */
const GERMAN_WORDS = /\b(Spielen|Nochmal|Einstellungen|Hilfe|Feuer|Gegner|Schritte?|Weiter|Zahlenstrahl|Fortschritt|Sterne|Runde|Treffer|Getroffen|Abbrechen|Speichern|Laden|Neue Landschaft|Garage)\b/;

/** The code without comments, keeping string contents (a `//` inside a string is not a comment). */
function withoutComments(code: string): string {
  return code.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (_m, str: string | undefined) => str ?? '');
}

/** String literals, template literals and JSX text (between `>` and `<`); module paths of imports are skipped. */
export function textsIn(code: string): string[] {
  const clean = withoutComments(code).replace(/\b(from|import)\s*(['"])[^'"]*\2/g, '');
  const literals = [...clean.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
  const jsx = [...clean.matchAll(/>([^<>{}]*[\p{L}][^<>{}]*)</gu)].map((m) => m[1]!.trim());
  return [...literals, ...jsx];
}

export function looksGerman(text: string): boolean {
  return UMLAUT.test(text) || GERMAN_WORDS.test(text);
}

describe('no German text outside src/i18n (T151, FR-056)', () => {
  it('the check finds German literals and JSX text, and skips comments', () => {
    const code = `
      // Zurück zum Spiel
      /* Spielen */
      const a = 'Schließen';
      const b = <button>Nochmal</button>;
      const c = "data-phase";
      import { Garage } from './Garage';
    `;
    expect(textsIn(code).filter(looksGerman)).toEqual(['Schließen', 'Nochmal']);
  });

  it('src/app and src/game hold no German text', () => {
    const files = Object.entries(SOURCES);
    expect(files.length).toBeGreaterThan(10);
    expect(files.some(([path]) => path.endsWith('.test.tsx'))).toBe(false);
    const found = files.flatMap(([path, code]) => textsIn(code).filter(looksGerman).map((text) => `${path}: ${text}`));
    expect(found).toEqual([]);
  });
});
