/**
 * German translation table (research R15, FR-056). Source of truth for message keys:
 * another language adds a file of type `Messages` with the same shape.
 * Child-facing strings must never contain a word from `forbiddenWords` (FR-033).
 */
export const de = {
  appName: 'Mathe-Panzer',

  start: {
    play: 'Spielen',
    freePlay: 'Freies Spiel',
    fullscreen: 'Vollbild',
    parentHint: 'Für Eltern: Zahnrad gedrückt halten',
    gear: 'Für Eltern',
    updateReady: 'Eine neue Version ist bereit.',
  },

  battle: {
    help: 'Hilfe',
    fire: 'Feuer!',
    continue: 'Weiter',
    pause: 'Pause',
    resume: 'Weiterspielen',
    yourNumber: 'Deine Zahl',
    yourTurn: 'Du bist dran.',
    enemyTurn: 'Der Gegner ist dran.',
    enemyFound: 'Gefunden!',
    newScene: 'Neue Landschaft',
    /** Amendment 05: the bouncing arrow over the child's tank at the start of every round (FR-077). */
    you: 'Du',
    /** Amendment 06: the exact number destroys the enemy (FR-066). */
    hit: 'Getroffen!',
    /** Amendment 06: on the tank body but not at the number, a miss (FR-066, FR-072). */
    near: 'Ganz knapp! Triff die Linie.',
    /** T215: a near miss while the enemy is still hidden; there is no line yet and no enemy number (FR-010). */
    nearHidden: 'Ganz knapp!',
    /** Amendment 06: label of the tank counter at the top, for screen readers only (FR-083). */
    score: 'Getroffene Panzer',
    /** Amendment 06: label of the optional clock, for screen readers only (FR-084). */
    clock: 'Spielzeit',
    /** Amendment 06: label of the hearts, for screen readers only (FR-080). */
    lives: (n: number) => (n === 1 ? 'Noch 1 Herz' : `Noch ${n} Herzen`),
    /** Amendment 04: both numbers and the distance after a near miss on the body (FR-072). */
    compare: (you: number, enemy: number) => {
      const d = Math.abs(you - enemy);
      return `Du: ${you} · Gegner: ${enemy} · ${d === 1 ? '1 Schritt' : `${d} Schritte`}`;
    },
    enemyStoodAt: (n: number) => `Der Gegner stand bei ${n}.`,
    landedAt: (n: number) => `Gelandet bei ${n}`,
    steps: (n: number) => (n === 1 ? '1 Schritt' : `${n} Schritte`),
    rangeHint: (min: number, max: number) => `Zahlen von ${min} bis ${max}`,
    turnsLeft: (n: number) => (n === 1 ? 'Noch 1 Zug' : `Noch ${n} Züge`),
  },

  /** Challenge banner (T069, FR-056, FR-057): at most about 8 words each. */
  challenge: {
    findNumber: (n: number) => `Finde ${n}`,
    after: (n: number) => `Welche Zahl kommt direkt nach ${n}?`,
    before: (n: number) => `Welche Zahl kommt direkt vor ${n}?`,
    stepsRight: (n: number, k: number) => `Von ${n} aus ${k === 1 ? '1 Schritt' : `${k} Schritte`} nach rechts.`,
    stepsLeft: (n: number, k: number) => `Von ${n} aus ${k === 1 ? '1 Schritt' : `${k} Schritte`} nach links.`,
    missingBetween: (a: number, b: number) => `Welche Zahl liegt zwischen ${a} und ${b}?`,
    midpoint: (a: number, b: number) => `Welche Zahl liegt mitten zwischen ${a} und ${b}?`,
    readPosition: 'Wo steht der Gegner?',
    addition: (a: number, b: number, c?: number) => `${a} + ${b}${c === undefined ? '' : ` + ${c}`} = ?`,
    subtraction: (a: number, b: number, c?: number) => `${a} − ${b}${c === undefined ? '' : ` − ${c}`} = ?`,
    greater: 'Tippe auf die größere Zahl.',
    smaller: 'Tippe auf die kleinere Zahl.',
    largest3: 'Tippe auf die größte Zahl.',
    smallest3: 'Tippe auf die kleinste Zahl.',
    order3: 'Tippe die Zahlen von klein nach groß an.',
    closestTo: (n: number) => `Welche Zahl ist am nächsten an ${n}?`,
    between: (a: number, b: number) => `Welche Zahl liegt zwischen ${a} und ${b}?`,
  },

  helpSteps: {
    nearestTen: (n: number) => `Schau zuerst zur ${n}.`,
    countSteps: (n: number) => `Zähle ${n} Schritte.`,
    solution: (n: number) => `Hier ist die ${n}.`,
  },

  /** Amendment 06 (FR-085, FR-086): result, time and the personal best, never a comparison. */
  roundEnd: {
    goalReached: 'Super! Alle Gegner getroffen.',
    heartsGone: 'Gut gekämpft! Noch eine Runde?',
    result: (enemies: number, time: string) => `${enemies} Panzer getroffen in ${time}`,
    newRecord: 'Neuer Rekord!',
    yourRecord: (n: number) => `Dein Rekord: ${n}`,
    again: 'Nochmal',
    backToStart: 'Zum Start',
  },

  parent: {
    holdGear: 'Zahnrad gedrückt halten',
    menu: 'Für Eltern',
    /** Amendment 05, FR-079: a feature that is not built yet. */
    comingSoon: 'kommt bald',
    settings: 'Einstellungen',
    progress: 'Fortschritt',
    close: 'Schließen',
    exportData: 'Daten sichern',
    importData: 'Daten laden',
    storageReset: 'Gespeicherte Daten konnten nicht gelesen werden. Die Standardwerte gelten.',
    storageUnavailable: 'Speichern ist in diesem Browser nicht möglich.',
  },

  settings: {
    title: 'Einstellungen',
    save: 'Speichern',
    saved: 'Gespeichert. Die Einstellungen gelten ab der nächsten Runde.',
    saveFailed: 'Speichern hat nicht geklappt. Die Einstellungen gelten nur, bis der Browser geschlossen wird.',
    checkFields: 'Bitte die markierten Felder prüfen.',
    persistDenied: 'Der Browser darf gespeicherte Daten löschen. Bitte die Daten ab und zu sichern.',
    presetCustom: 'Eigener Zahlenraum',
    levelOption: (n: number) => `Stufe ${n}`,
    stepsOption: (n: number) => (n === 1 ? '1 Schritt' : `${n} Schritte`),
    preview: (min: number, max: number, level: number) => `Vorschau: Zahlenstrahl von ${min} bis ${max}, Stufe ${level}`,
    previewUnavailable: 'Die Vorschau erscheint, sobald der Zahlenraum gültig ist.',
    /** Shown when every challenge type is off (FR-047, US6 scenario 4). */
    guidedNeedsType: 'Geführtes Spielen braucht mindestens eine Aufgabenart. Ohne Aufgabenart gibt es nur freies Spiel.',
    offerFreePlay: 'Nur freies Spiel anbieten',
    data: {
      title: 'Daten',
      exportHint: 'Speichert Einstellungen, Fortschritt und Rekorde in einer Datei.',
      imported: 'Daten geladen. Die Einstellungen gelten ab der nächsten Runde.',
      importFailed: {
        notJson: 'Diese Datei ist keine Sicherung von Mathe-Panzer.',
        wrongApp: 'Diese Datei ist keine Sicherung von Mathe-Panzer.',
        invalidSettings: 'Die Einstellungen in dieser Datei sind ungültig. Es wurde nichts geändert.',
        invalidProgress: 'Der Fortschritt in dieser Datei ist ungültig. Es wurde nichts geändert.',
        invalidRecords: 'Die Rekorde in dieser Datei sind ungültig. Es wurde nichts geändert.',
      },
      readFailed: 'Die Datei konnte nicht gelesen werden.',
      /** FR-048a: the Home Screen keeps stored data on Safari. */
      homeScreen:
        'Tipp: Auf dem Home-Bildschirm behält der Browser die Daten sicherer. iPad: in Safari auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen. Android: in Chrome im Menü „Zum Startbildschirm hinzufügen“ wählen.',
    },
    groups: {
      challengeTypes: 'Aufgaben',
      range: 'Zahlenraum',
      arithmetic: 'Plus und Minus',
      numberLine: 'Zahlenstrahl',
      help: 'Hilfe',
      enemy: 'Gegner',
      sound: 'Ton',
      round: 'Runde',
    },
    labels: {
      numberLine: 'Zahlenstrahl',
      addition: 'Plus',
      subtraction: 'Minus',
      comparison: 'Vergleichen',
      rangePreset: 'Zahlenraum',
      rangeCustom: 'Eigener Zahlenraum',
      rangeMin: 'Von',
      rangeMax: 'Bis',
      additionMaxOperand: 'Größte Zahl beim Plus',
      additionMaxResult: 'Größtes Ergebnis',
      subtractionMaxOperand: 'Größte Zahl beim Minus',
      steps: 'Rechenschritte',
      additionSteps: 'Rechenschritte beim Plus',
      subtractionSteps: 'Rechenschritte beim Minus',
      crossTens: 'Über den Zehner',
      crossHundreds: 'Über den Hunderter',
      negativeResults: 'Ergebnisse unter null',
      rulerLevelStart: 'Zahlenstrahl am Anfang',
      rulerLevelMax: 'Schwerste Stufe des Zahlenstrahls',
      enemyDifficulty: 'Gegner',
      enemyEasy: 'Leicht',
      enemyNormal: 'Normal',
      enemyChallenging: 'Anspruchsvoll',
      helpNearestTen: 'Hinweis auf den nächsten Zehner',
      helpCountSteps: 'Schritte zählen',
      helpZoom: 'Vergrößern',
      helpStepAnimation: 'Schritte zeigen',
      beginnerAssist: 'Einstiegshilfe',
      soundEffects: 'Geräusche',
      music: 'Musik',
      speech: 'Vorlesen',
      roundType: 'Rundenende',
      roundTypeUntilHearts: 'Bis alle Herzen weg',
      roundTypeEnemyCount: 'Gegner pro Runde',
      roundLength: 'Anzahl der Gegner',
      showClock: 'Uhr beim Spielen zeigen',
      showRecords: 'Rekord zeigen',
      adaptive: 'Schwierigkeit automatisch anpassen',
      freePlay: 'Freies Spiel erlauben',
      noDamage: 'Ohne Schaden spielen',
      timeLimit: 'Zeitlimit',
      timeLimitSeconds: 'Sekunden pro Aufgabe',
    },
  },

  /** Keys match SETTINGS_ERROR_KEYS in src/core/settings/validate.ts. Shown to parents. */
  settingsErrors: {
    rangeNotInteger: 'Bitte ganze Zahlen eingeben.',
    rangeOrder: '„Von“ muss kleiner sein als „Bis“.',
    rangeSpan: 'Der Zahlenraum muss 5 bis 1000 Zahlen umfassen.',
    rangeMinOutside: '„Von“ muss zwischen −1000 und 9000 liegen.',
    rangePresetMismatch: 'Der Zahlenraum passt nicht zur Auswahl.',
    noChallengeTypes: 'Bitte mindestens eine Aufgabenart wählen oder freies Spiel erlauben.',
    rulerLevelOrder: 'Die Startstufe darf nicht schwerer sein als die schwerste Stufe.',
    roundLength: 'Eine Runde hat 1 bis 20 Gegner.',
    roundTypeNoDamage: '„Bis alle Herzen weg“ geht nicht ohne Schaden. Bitte „Gegner pro Runde“ wählen.',
    timeLimit: 'Das Zeitlimit liegt zwischen 10 und 120 Sekunden.',
    additionMaxOperand: 'Die größte Zahl beim Plus muss mindestens 1 sein.',
    additionMaxResult: 'Das größte Ergebnis darf nicht über dem Zahlenraum liegen.',
    additionNoExercise: 'Mit diesen Grenzen gibt es keine Plus-Aufgabe.',
    subtractionMaxOperand: 'Die größte Zahl beim Minus muss zwischen 1 und der Größe des Zahlenraums liegen.',
    subtractionNoExercise: 'Mit diesen Grenzen gibt es keine Minus-Aufgabe.',
  },

  /** Encouraging feedback after a wrong answer (FR-033, FR-057): at most 8 words each. */
  encouragements: [
    'Versuch eine andere Stelle.',
    'Fast! Schau noch einmal genau hin.',
    'Probier es gleich noch einmal.',
    'Du schaffst das. Noch ein Versuch!',
    'Nicht ganz. Zähl in Ruhe nach.',
    'Schau dir den Zahlenstrahl noch einmal an.',
    'Gute Idee! Versuch es etwas weiter.',
    'Weiter so, du bist auf dem Weg.',
    'Lass dir Zeit und probier nochmal.',
  ] as readonly string[],
};
