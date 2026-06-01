/** Which system produced a translation. Never shown to participants. */
export type Source = 'agency' | 'ai';

export interface TranslationItem {
  id: string;
  source: string; // English source text
  agency: string; // official agency translation
  ai: string; // AI-generated translation
}

export interface LanguageData {
  code: string; // e.g. "es", "zh-tw"
  name: string; // e.g. "Spanish"
  items: TranslationItem[];
}

export interface TranslationFile {
  languages: LanguageData[];
}

/** A participant's pick for one comparison. `tie` means "both are good". */
export type Pick = Source | 'tie';

/** A single A/B decision made by a participant. */
export interface Choice {
  itemId: string;
  chosen: Pick; // which system was preferred, or 'tie' if both were good
  leftWas: Source; // which system was shown on the left
  msSpent: number; // time spent on this comparison
}

export interface ResultSummary {
  total: number;
  aiPreferred: number;
  agencyPreferred: number;
  ties: number;
}

/** The downloadable output for one participant + language run. */
export interface ResultFile {
  participant: string;
  language: string; // language code
  languageName: string;
  startedAt: string; // ISO timestamp
  completedAt: string; // ISO timestamp
  choices: Choice[];
  summary: ResultSummary;
}
