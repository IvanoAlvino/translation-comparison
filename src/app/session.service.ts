import { Injectable, computed, signal } from '@angular/core';
import {
  Choice,
  LanguageData,
  Pick,
  ResultFile,
  Source,
  TranslationFile,
  TranslationItem,
} from './models';

/** One comparison as presented to the participant, with side assignment hidden in `leftWas`. */
interface PreparedComparison {
  item: TranslationItem;
  leftWas: Source;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly file = signal<TranslationFile | null>(null);

  readonly participant = signal('');
  readonly language = signal<LanguageData | null>(null);

  private readonly order = signal<PreparedComparison[]>([]);
  readonly index = signal(0);
  private readonly choices = signal<Choice[]>([]);

  private startedAt = '';
  private shownAt = 0;

  readonly languages = computed(() => this.file()?.languages ?? []);
  readonly total = computed(() => this.order().length);
  readonly current = computed(() => this.order()[this.index()] ?? null);
  readonly complete = computed(
    () => this.total() > 0 && this.index() >= this.total(),
  );

  /** Load the translation file once. Relative path so it works under any deploy sub-path. */
  async load(): Promise<void> {
    if (this.file()) return;
    const res = await fetch('translations.json');
    if (!res.ok) throw new Error(`Failed to load translations.json (${res.status})`);
    this.file.set((await res.json()) as TranslationFile);
  }

  /** Begin a run: shuffle items and randomize left/right side per comparison. */
  start(name: string, language: LanguageData): void {
    this.participant.set(name.trim());
    this.language.set(language);
    this.order.set(
      [...language.items]
        .sort(() => Math.random() - 0.5)
        .map((item) => ({
          item,
          leftWas: Math.random() < 0.5 ? 'agency' : 'ai',
        })),
    );
    this.index.set(0);
    this.choices.set([]);
    this.startedAt = new Date().toISOString();
    this.shownAt = Date.now();
  }

  /** Record the participant's pick and advance. `both` records a tie. */
  choose(pick: 'left' | 'right' | 'both'): void {
    const comparison = this.current();
    if (!comparison) return;
    const chosen: Pick =
      pick === 'both'
        ? 'tie'
        : pick === 'left'
          ? comparison.leftWas
          : comparison.leftWas === 'agency'
            ? 'ai'
            : 'agency';
    this.choices.update((c) => [
      ...c,
      {
        itemId: comparison.item.id,
        chosen,
        leftWas: comparison.leftWas,
        msSpent: Date.now() - this.shownAt,
      },
    ]);
    this.shownAt = Date.now();
    this.index.update((i) => i + 1);
  }

  buildResult(): ResultFile {
    const choices = this.choices();
    const aiPreferred = choices.filter((c) => c.chosen === 'ai').length;
    const agencyPreferred = choices.filter((c) => c.chosen === 'agency').length;
    const ties = choices.filter((c) => c.chosen === 'tie').length;
    return {
      participant: this.participant(),
      language: this.language()?.code ?? '',
      languageName: this.language()?.name ?? '',
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
      choices,
      summary: {
        total: choices.length,
        aiPreferred,
        agencyPreferred,
        ties,
      },
    };
  }

  hasSession(): boolean {
    return this.language() !== null && this.total() > 0;
  }
}
