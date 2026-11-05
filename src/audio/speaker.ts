/**
 * Spoken challenges (FR-055, research R14): the browser's speechSynthesis with a German voice, behind the `Speaker`
 * port. `available` is false when the browser has no speech API or no German voice; the overlay then hides the speaker
 * button. Voices load late in some browsers, so `available` asks again each time. Each `speak` cancels earlier speech,
 * so a new challenge never waits behind an old one. Tablet browsers speak only after a user tap, so the "Spielen" tap
 * (or the starting Enter) calls `prime()`, which speaks a short greeting.
 */
import type { Speaker } from '../core/battle/ports';
import { t } from '../i18n';

/** The parts of the Web Speech API this module uses; tests pass a stand-in. */
export interface SpeechLike {
  synth: Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel'>;
  Utterance: typeof SpeechSynthesisUtterance;
}

export interface BrowserSpeaker extends Speaker {
  /** Speaks a short greeting; call from a user gesture (FR-055). */
  prime(): void;
}

/** The browser's speech API, or null where it is missing. */
export function browserSpeech(): SpeechLike | null {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return null;
  return { synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance };
}

function isGerman(voice: SpeechSynthesisVoice): boolean {
  return /^de([-_]|$)/i.test(voice.lang);
}

export function createSpeaker(speech: SpeechLike | null = browserSpeech()): BrowserSpeaker {
  const germanVoice = (): SpeechSynthesisVoice | null => {
    if (!speech) return null;
    try {
      const voices = speech.synth.getVoices();
      return voices.find((v) => isGerman(v) && /^de[-_]DE$/i.test(v.lang)) ?? voices.find(isGerman) ?? null;
    } catch {
      return null;
    }
  };

  const speak = (text: string): void => {
    const voice = germanVoice();
    if (!speech || !voice) return;
    try {
      speech.synth.cancel();
      const u = new speech.Utterance(text);
      u.lang = 'de-DE';
      try {
        u.voice = voice;
      } catch {
        // Some browsers accept only their own voice objects; lang alone still picks a German voice.
      }
      u.rate = 0.95;
      speech.synth.speak(u);
    } catch {
      // Speech failed; the game goes on with the written challenge.
    }
  };

  return {
    get available() {
      return germanVoice() !== null;
    },
    speak,
    prime() {
      speak(t().start.greeting);
    },
  };
}
