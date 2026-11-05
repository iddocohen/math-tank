/**
 * German translation table (research R15, FR-056). Source of truth for message keys:
 * another language adds a file of type `Messages` with the same shape.
 * Child-facing strings must never contain a word from `forbiddenWords` (FR-033).
 */

/** "1 Schritt" or "n Schritte". */
function stepCount(n: number): string {
  return n === 1 ? '1 Schritt' : `${n} Schritte`;
}

export const de = {
  appName: 'Mathe-Panzer',

  start: {
    play: 'Spielen',
    /** Amendment 17 (FR-121): the play mode buttons on the start screen. */
    modes: { mixed: 'Gemischt', ruler: 'Nur Zahlenstrahl', math: 'Nur Rechnen' },
    fullscreen: 'Vollbild',
    parentHint: 'Für Eltern: Zahnrad gedrückt halten',
    gear: 'Für Eltern',
    updateReady: 'Eine neue Version ist bereit.',
    /** Amendment 11 (FR-091): the button that opens the tank garage. */
    garage: 'Garage',
    /** FR-055: spoken once by the "Spielen" start, so tablet browsers allow speech for the session. */
    greeting: 'Los geht es!',
    /** Review H1: a small note for the parent when saving failed during play; it does not block the game. */
    saveFailed: 'Speichern klappt gerade nicht.',
  },

  /** Amendment 11 (FR-089 to FR-095): the tank garage. Short words for a child. */
  garage: {
    title: 'Garage',
    back: 'Zurück',
    preview: 'Dein Panzer',
    kinds: { color: 'Farbe', flag: 'Flagge', trail: 'Spur', hat: 'Hut' },
    items: {
      blue: 'Blau',
      sky: 'Himmelblau',
      teal: 'Blaugrün',
      turquoise: 'Türkis',
      navyStripes: 'Dunkelblau mit Streifen',
      star: 'Stern-Flagge',
      rocket: 'Raketen-Flagge',
      dragon: 'Drachen-Flagge',
      football: 'Fußball-Flagge',
      lightning: 'Blitz-Flagge',
      plain: 'Einfache Spur',
      sparkles: 'Funkel-Spur',
      rainbow: 'Regenbogen-Spur',
      bubbles: 'Blasen-Spur',
      none: 'Ohne Hut',
      crown: 'Krone',
      helmet: 'Helm',
    },
    /** Amendment 19 (FR-130): the price of an item not owned. */
    price: (n: number) => `★ ${n}`,
    buyQuestion: (n: number) => `Für ${n} Sterne kaufen?`,
    yes: 'Ja',
    no: 'Nein',
    /** Amendment 19 (FR-131): give an owned item back for its full price. */
    returnItem: 'Zurückgeben',
    returnQuestion: (n: number) => `Zurückgeben? Du bekommst ${n} Sterne.`,
    /** An item the balance does not reach (FR-091). */
    stillNeeded: (n: number) => (n === 1 ? 'noch 1 Stern' : `noch ${n} Sterne`),
    chosen: 'Gewählt',
    /** The star total, for screen readers (FR-095). */
    stars: (n: number) => (n === 1 ? '1 Stern' : `${n} Sterne`),
  },

  battle: {
    help: 'Hilfe',
    fire: 'Feuer!',
    /** US5 step 3 (FR-013, FR-031): the fire button names the solution. */
    fireAt: (n: number) => `Feuer auf ${n}`,
    /** FR-034: the gentle indicator of a parent-set time limit, for screen readers only. */
    helpSoon: 'Gleich kommt Hilfe',
    continue: 'Weiter',
    pause: 'Pause',
    resume: 'Weiterspielen',
    /** FR-055: the speaker button that reads the current challenge aloud again. */
    speak: 'Aufgabe vorlesen',
    yourNumber: 'Deine Zahl',
    yourTurn: 'Du bist dran.',
    enemyTurn: 'Der Gegner ist dran.',
    enemyFound: 'Gefunden!',
    newScene: 'Neue Landschaft',
    /** Amendment 05: the bouncing arrow over the child's tank at the start of every round (FR-077). */
    you: 'Du',
    /** Amendment 06: the exact number destroys the enemy (FR-066). */
    hit: 'Getroffen!',
    /** Amendment 18 (FR-129): a hit after the shown solution with "Punkt nach voller Hilfe" off; it does not count. */
    hitWithHelp: 'Getroffen, mit Hilfe.',
    /** Amendment 06: on the tank body but not at the number, a miss (FR-066, FR-072). */
    near: 'Ganz knapp! Triff die Linie.',
    /** Amendment 06: label of the tank counter at the top, for screen readers only (FR-083). */
    score: 'Getroffene Panzer',
    /** Amendment 06: label of the optional clock, for screen readers only (FR-084). */
    clock: 'Spielzeit',
    /** Amendment 06: label of the hearts, for screen readers only (FR-080). */
    lives: (n: number) => (n === 1 ? 'Noch 1 Herz' : `Noch ${n} Herzen`),
    /**
     * Amendment 04: the child's number and the distance after a near miss on the body (FR-072). Changed by product
     * owner: no enemy number after a miss; `enemy` only gives the distance.
     */
    compare: (you: number, enemy: number) => `Du: ${you} · ${stepCount(Math.abs(you - enemy))}`,
    enemyStoodAt: (n: number) => `Der Gegner stand bei ${n}.`,
    landedAt: (n: number) => `Gelandet bei ${n}`,
    steps: stepCount,
    rangeHint: (min: number, max: number) => `Zahlen von ${min} bis ${max}`,
    /** Amendment 12 (FR-102): the on-screen number pad and its keys, for screen readers. */
    numberPad: 'Zahlenfeld',
    backspace: 'Löschen',
    minus: 'Minus',
  },

  /** Amendment 12 (FR-104): a phone held upright. */
  rotate: {
    turnPhone: 'Bitte dreh das Handy',
  },

  /** Challenge banner (T069, FR-056, FR-057): at most about 8 words each. */
  challenge: {
    findNumber: (n: number) => `Finde ${n}`,
    after: (n: number) => `Welche Zahl kommt direkt nach ${n}?`,
    before: (n: number) => `Welche Zahl kommt direkt vor ${n}?`,
    /** PO3: worded like the other "Der Gegner ..." banners; "Von 2 aus 2 Schritte nach links." read as illogical. */
    stepsRight: (n: number, k: number) => `Der Gegner steht ${stepCount(k)} rechts von ${n}.`,
    stepsLeft: (n: number, k: number) => `Der Gegner steht ${stepCount(k)} links von ${n}.`,
    missingBetween: (a: number, b: number) => `Welche Zahl liegt zwischen ${a} und ${b}?`,
    midpoint: (a: number, b: number) => `Welche Zahl liegt mitten zwischen ${a} und ${b}?`,
    readPosition: 'Wo steht der Gegner?',
    // US3: the result of the exercise is the enemy's number (T083).
    addition: (a: number, b: number, c?: number) => `Der Gegner ist bei ${a} + ${b}${c === undefined ? '' : ` + ${c}`}`,
    subtraction: (a: number, b: number, c?: number) => `Der Gegner ist bei ${a} − ${b}${c === undefined ? '' : ` − ${c}`}`,
    // US4 (amendment 09, FR-026): the start of the question; the banner adds the options, e.g. "47 oder 74".
    greater: 'Der Gegner steht bei der größeren Zahl:',
    smaller: 'Der Gegner steht bei der kleineren Zahl:',
    largest3: 'Der Gegner steht bei der größten Zahl:',
    smallest3: 'Der Gegner steht bei der kleinsten Zahl:',
    closestTo: (n: number) => `Der Gegner steht bei der Zahl näher an ${n}:`,
    between: (a: number, b: number) => `Der Gegner steht bei der Zahl zwischen ${a} und ${b}:`,
    middle3: 'Der Gegner steht bei der mittleren Zahl:',
    /** Between two options: "47 oder 74"; three options are separated by commas. */
    optionsOr: 'oder',
  },

  /** Help steps (US5, FR-031, FR-033): one line per step, from i18n helpText. */
  helpSteps: {
    /** Step 1: the direction from the landing number to the answer. */
    direction: { right: 'Weiter nach rechts', left: 'Weiter nach links' },
    nearestTen: (n: number) => `Schau zuerst zur ${n}.`,
    countSteps: (n: number) => `Zähle ${n} Schritte.`,
    /** Step 2: the count from the landing number (or the nearest major line) to the answer. */
    countFrom: (from: number, n: number) => `Zähle von ${from} aus ${stepCount(n)}.`,
    zoom: 'Schau genau auf diesen Zehner.',
    /** Step 2 of addition and subtraction: the marker moves along the step path. */
    stepAnimation: 'Zähl mit, Schritt für Schritt.',
    /** Comparison step 1 and step 2. */
    tensDigits: 'Vergleiche zuerst die Zehner.',
    optionMarkers: 'Weiter rechts steht die größere Zahl.',
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
    /** Amendment 19 (FR-094): the stars of this round, and one item the balance now reaches. */
    starsEarned: (n: number) => (n === 1 ? '+1 Stern' : `+${n} Sterne`),
    affordable: (name: string) => `Genug Sterne für: ${name}`,
  },

  parent: {
    holdGear: 'Zahnrad gedrückt halten',
    menu: 'Für Eltern',
    settings: 'Einstellungen',
    progress: 'Fortschritt',
    close: 'Schließen',
    exportData: 'Daten sichern',
    importData: 'Daten laden',
    /** Review M3: names the data that was reset; a copy of the old text stays in the browser (review M2). */
    storageReset: (names: string) =>
      `Gespeicherte Daten konnten nicht gelesen werden (${names}). Dafür gelten die Standardwerte. Die alten Daten bleiben als Kopie im Browser.`,
    /** Review M2: data written by a newer version of the game in another tab or on a later visit. */
    storageNewer: (names: string) =>
      `Gespeicherte Daten stammen aus einer neueren Version des Spiels (${names}). Sie werden nicht überschrieben. Bitte die Seite neu laden.`,
    storageUnavailable: 'Speichern ist in diesem Browser nicht möglich.',
    /** The four kinds of stored data, for the notices on the settings page (review H1, M3). */
    dataNames: { settings: 'Einstellungen', progress: 'Fortschritt', records: 'Rekorde', garage: 'Sterne und Garage' },
    /** Review H1: shown while the latest save of these data failed, also when it happened during play. */
    saveFailedData: (names: string) =>
      `Speichern hat nicht geklappt (${names}). Diese Daten gelten nur, bis der Browser geschlossen wird. Bitte „Daten sichern“ nutzen.`,
  },

  /** Parent progress page (FR-040, FR-087). Shown to parents. */
  progressPage: {
    title: 'Fortschritt',
    skillsTitle: 'Fähigkeiten',
    columns: {
      skill: 'Fähigkeit',
      range: 'Zahlenraum',
      attempts: 'Aufgaben',
      independent: 'Allein richtig',
      withHelp: 'Mit Hilfe',
      step: 'Schwierigkeitsstufe',
      toRaise: 'Bis zur nächsten Stufe',
      status: 'Stand',
    },
    skills: {
      positions: 'Zahlen am Zahlenstrahl',
      countForward: 'Vorwärts zählen',
      countBackward: 'Rückwärts zählen',
      tens: 'Zehner verstehen',
      crossTens: 'Über den Zehner',
      addition: 'Plus',
      subtraction: 'Minus',
      comparison: 'Vergleichen',
    },
    status: { mastered: 'sicher', developing: 'noch am Üben' },
    range: (min: number, max: number) => `${min} bis ${max}`,
    step: (n: number, of: number) => `${n} von ${of}`,
    /** Amendment 17 (FR-040): how many more correct answers in a row raise the step. */
    toRaise: (n: number) => `noch ${n} richtig in Folge`,
    topStep: 'höchste Stufe',
    adaptiveOff: '–',
    mostHelpTitle: 'Am meisten Hilfe gebraucht',
    mostHelpLine: (skill: string, range: string, n: number) => `${skill}, ${range}: ${n}-mal mit Hilfe oder Lösung gezeigt`,
    noHelp: 'Bisher ohne Hilfe gelöst.',
    sessionsTitle: 'Spielzeiten',
    sessionColumns: { date: 'Datum', attempts: 'Aufgaben', independent: 'Allein richtig', withHelp: 'Mit Hilfe' },
    bestsTitle: 'Rekorde',
    bestColumns: { range: 'Zahlenraum', roundType: 'Rundenende', level: 'Zahlenstrahl am Anfang', mode: 'Spielart', enemies: 'Gegner getroffen', time: 'Zeit' },
    level: (n: number) => `Stufe ${n}`,
    empty: 'Noch keine Aufgaben gespielt.',
    noBests: 'Noch keine Rekorde.',
    reset: 'Fortschritt zurücksetzen',
    resetConfirm: 'Den ganzen Fortschritt zurücksetzen? Die Rekorde und Sterne bleiben erhalten.',
    resetYes: 'Ja, zurücksetzen',
    resetNo: 'Abbrechen',
    resetDone: 'Der Fortschritt wurde zurückgesetzt.',
    /** Amendment 11 (FR-096): the stars of the tank garage, reset only here. */
    stars: (n: number) => `Sterne in der Garage: ${n}`,
    /** Amendment 19 (FR-132): every star ever earned, also the spent ones. */
    starsTotal: (n: number) => `Insgesamt verdient: ${n}`,
    starsReset: 'Sterne zurücksetzen',
    starsResetConfirm: 'Alle Sterne und gekauften Teile löschen? Die Garage ist dann wieder leer.',
    starsResetYes: 'Ja, Sterne zurücksetzen',
    starsResetDone: 'Die Sterne wurden zurückgesetzt.',
  },

  settings: {
    title: 'Einstellungen',
    save: 'Speichern',
    saved: 'Gespeichert. Die Einstellungen gelten ab der nächsten Runde.',
    saveFailed: 'Speichern hat nicht geklappt. Die Einstellungen gelten nur, bis der Browser geschlossen wird.',
    checkFields: 'Bitte die markierten Felder prüfen.',
    /** Bug "iPhone rotation in Chrome" (Phase 24): which build runs, the short git commit and the build day. */
    version: (version: string, date: string) => `Version ${version} vom ${date}`,
    persistDenied: 'Der Browser darf gespeicherte Daten löschen. Bitte die Daten ab und zu sichern.',
    presetCustom: 'Eigener Zahlenraum',
    levelOption: (n: number) => `Stufe ${n}`,
    stepsOption: stepCount,
    preview: (min: number, max: number, level: number) => `Vorschau: Zahlenstrahl von ${min} bis ${max}, Stufe ${level}`,
    /** Captions of the two ruler previews (FR-069, T218). */
    previewStart: 'Am Anfang',
    previewMax: 'Schwerste Stufe',
    previewUnavailable: 'Die Vorschau erscheint, sobald der Zahlenraum gültig ist.',
    /** Shown when every challenge type is off (FR-047, US6 scenario 4). */
    guidedNeedsType: '„Gemischt“ und „Nur Rechnen“ brauchen mindestens eine Aufgabenart. Ohne Aufgabenart gibt es nur „Nur Zahlenstrahl“.',
    offerRulerOnly: 'Nur „Nur Zahlenstrahl“ anbieten',
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
        invalidGarage: 'Die Sterne in dieser Datei sind ungültig. Es wurde nichts geändert.',
        notSaved: 'Die Datei ist in Ordnung, aber Speichern hat nicht geklappt. Es wurde nichts geändert.',
      },
      readFailed: 'Die Datei konnte nicht gelesen werden.',
      /** Review L3: the browser refused the download. */
      exportFailed: 'Die Sicherung konnte nicht heruntergeladen werden.',
      /** FR-048a: the Home Screen keeps stored data on Safari. */
      homeScreen:
        'Tipp: Auf dem Home-Bildschirm behält der Browser die Daten sicherer. iPad: in Safari auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen. Android: in Chrome im Menü „Zum Startbildschirm hinzufügen“ wählen.',
    },
    /** Amendment 15 (FR-115 to FR-118): move the save to another browser. Shown to parents. */
    transfer: {
      title: 'Spielstand übertragen',
      hint: 'Mit der Kamera des anderen Geräts scannen oder den Link dort öffnen.',
      qrLabel: 'QR-Code mit dem Spielstand',
      showLarge: 'QR groß anzeigen',
      closeLarge: 'Schließen',
      copy: 'Link kopieren',
      copied: 'Link kopiert.',
      copyFailed: 'Kopieren hat nicht geklappt. Bitte diesen Link kopieren:',
      trimmed: 'Ältere Sitzungen fehlen im Code. Den ganzen Verlauf überträgt nur „Daten sichern“.',
      tooLarge: 'Der Spielstand ist zu groß für einen QR-Code. Bitte den Link kopieren. Den ganzen Verlauf überträgt nur „Daten sichern“.',
      /** Review M5: the code could not be built at all. */
      buildFailed: 'Der Code konnte nicht erstellt werden. Bitte „Daten sichern“ nutzen.',
    },
    /** Amendment 14 (FR-114): credits for the ground texture, although CC0 does not require them. */
    credits: {
      text: 'Bodentextur „dirt“ von Drummyfish, Lizenz CC0.',
      link: 'Seite auf OpenGameArt',
    },
    groups: {
      challengeTypes: 'Aufgaben',
      playModes: 'Spielarten',
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
      garage: 'Garage und Sterne',
      /** Amendment 12 (FR-102): the on-screen number pad. */
      numberPad: 'Zahlenfeld',
      numberPadAuto: 'Automatisch',
      numberPadAlways: 'Immer',
      numberPadNever: 'Nie',
      aimCross: 'Zielkreuz',
      aimCrossAlways: 'Immer',
      aimCrossUpToLevel: 'Bis Zahlenstrahl-Stufe',
      aimCrossNever: 'Nie',
      aimCrossLevel: 'Zielkreuz bis Stufe',
      adaptive: 'Schwierigkeit automatisch anpassen',
      playModeMixed: 'Spielart „Gemischt“ anbieten',
      playModeRuler: 'Spielart „Nur Zahlenstrahl“ anbieten',
      playModeMath: 'Spielart „Nur Rechnen“ anbieten',
      noDamage: 'Ohne Schaden spielen',
      timeLimit: 'Zeitlimit',
      timeLimitSeconds: 'Sekunden pro Aufgabe',
      /** Amendment 18 (FR-129). */
      pointAfterFullHelp: 'Punkt nach voller Hilfe',
    },
    /** Amendment 18 (FR-129): one line under each switch of the time limit and the point after the full help. */
    explanations: {
      aimCross: 'Das gelbe Kreuz mit der Linie zum Zahlenstrahl.',
      timeLimit: 'Ist die Zeit um, zeigt das Spiel den nächsten Hilfeschritt, ohne Strafe.',
      pointAfterFullHelp: 'Wenn aus: Ein Treffer nach der gezeigten Lösung bringt keinen Panzer, keinen Stern und zählt nicht für den Rekord.',
    },
  },

  /** Amendment 15 (FR-119, FR-120): the dialog when the game opens with a save link. Shown to parents. */
  transfer: {
    title: 'Spielstand übernehmen?',
    summary: (stars: number, record: number, min: number, max: number) => `Sterne: ${stars}, Rekord: ${record}, Zahlenraum: ${min} bis ${max}`,
    replaces: 'Ersetzt Einstellungen, Sterne, Rekorde und Fortschritt in diesem Browser.',
    holdHint: 'Zum Übernehmen 2 Sekunden gedrückt halten.',
    accept: 'Übernehmen',
    cancel: 'Abbrechen',
    invalid: 'Dieser Code passt nicht',
    /** Review M1: storing the save failed; nothing was changed. */
    saveFailed: 'Übernehmen hat nicht geklappt. Es wurde nichts geändert.',
    close: 'Schließen',
  },

  /** Keys match SETTINGS_ERROR_KEYS in src/core/settings/validate.ts. Shown to parents. */
  settingsErrors: {
    rangeNotInteger: 'Bitte ganze Zahlen eingeben.',
    rangeOrder: '„Von“ muss kleiner sein als „Bis“.',
    rangeSpan: 'Der Zahlenraum muss 5 bis 1000 Zahlen umfassen.',
    rangeMinOutside: '„Von“ muss zwischen −1000 und 9000 liegen.',
    rangePresetMismatch: 'Der Zahlenraum passt nicht zur Auswahl.',
    noChallengeTypes: 'Bitte mindestens eine Aufgabenart wählen oder nur „Nur Zahlenstrahl“ anbieten.',
    noPlayMode: 'Bitte mindestens eine Spielart anbieten.',
    rulerLevelOrder: 'Die Startstufe darf nicht schwerer sein als die schwerste Stufe.',
    roundLength: 'Eine Runde hat 1 bis 20 Gegner.',
    roundTypeNoDamage: '„Bis alle Herzen weg“ geht nicht ohne Schaden. Bitte „Gegner pro Runde“ wählen.',
    timeLimit: 'Das Zeitlimit liegt zwischen 10 und 120 Sekunden.',
    additionMaxOperand: 'Die größte Zahl beim Plus muss zwischen 1 und der Größe des Zahlenraums liegen.',
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
