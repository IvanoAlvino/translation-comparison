import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ResultFile } from '../../models';
import { SessionService } from '../../session.service';

interface Tally {
  key: string;
  total: number;
  ai: number;
  agency: number;
  tie: number;
}

/** Per-item breakdown, joined with the source/agency/AI text from translations.json. */
interface ItemStat {
  id: string;
  code: string;
  languageName: string;
  source: string;
  agency: string;
  ai: string;
  known: boolean;
  total: number;
  agencyPicks: number;
  aiPicks: number;
  ties: number;
}

@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  private readonly session = inject(SessionService);

  readonly results = signal<ResultFile[]>([]);
  readonly errors = signal<string[]>([]);

  readonly runCount = computed(() => this.results().length);

  readonly overall = computed<Tally>(() => this.tally(this.results(), 'Overall'));

  readonly byLanguage = computed<Tally[]>(() =>
    this.group((r) => r.languageName || r.language),
  );

  readonly byParticipant = computed<Tally[]>(() =>
    this.group((r) => r.participant || 'Unknown'),
  );

  /** Language filter for the agency-favored section. '' = all languages. */
  readonly agencyLang = signal<string>('');

  /** Languages present in the uploaded results, for the section's filter dropdown. */
  readonly resultLanguages = computed<{ code: string; name: string }[]>(() => {
    const map = new Map<string, string>();
    for (const r of this.results()) {
      if (r.language) map.set(r.language, r.languageName || r.language);
    }
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** itemId → its text, from the bundled translation file. */
  private readonly itemIndex = computed(() => {
    const map = new Map<
      string,
      { code: string; languageName: string; source: string; agency: string; ai: string }
    >();
    for (const lang of this.session.languages()) {
      for (const it of lang.items) {
        map.set(it.id, {
          code: lang.code,
          languageName: lang.name,
          source: it.source,
          agency: it.agency,
          ai: it.ai,
        });
      }
    }
    return map;
  });

  /** Items most often chosen as agency-best — i.e. where the AI is currently weakest. */
  readonly agencyFavored = computed<ItemStat[]>(() => {
    const counts = new Map<string, { agency: number; ai: number; tie: number }>();
    for (const run of this.results()) {
      for (const c of run.choices) {
        const e = counts.get(c.itemId) ?? { agency: 0, ai: 0, tie: 0 };
        if (c.chosen === 'agency') e.agency++;
        else if (c.chosen === 'ai') e.ai++;
        else e.tie++;
        counts.set(c.itemId, e);
      }
    }

    const idx = this.itemIndex();
    const lang = this.agencyLang();
    const stats: ItemStat[] = [];
    for (const [id, e] of counts) {
      if (e.agency === 0) continue; // only items reviewers actually preferred as agency
      const meta = idx.get(id);
      const code = meta?.code ?? id.split('-')[0];
      if (lang && code !== lang) continue; // section-scoped language filter
      stats.push({
        id,
        code,
        languageName: meta?.languageName ?? code,
        source: meta?.source ?? '',
        agency: meta?.agency ?? '',
        ai: meta?.ai ?? '',
        known: !!meta,
        total: e.agency + e.ai + e.tie,
        agencyPicks: e.agency,
        aiPicks: e.ai,
        ties: e.tie,
      });
    }
    // Most agency picks first; break ties by agency share of that item's votes.
    stats.sort(
      (a, b) =>
        b.agencyPicks - a.agencyPicks || b.agencyPicks / b.total - a.agencyPicks / a.total,
    );
    // Show the full ranked list when focused on one language; cap the combined view.
    return lang ? stats : stats.slice(0, 15);
  });

  filterLang(event: Event): void {
    this.agencyLang.set((event.target as HTMLSelectElement).value);
  }

  ngOnInit(): void {
    // Load translations so we can show the actual strings behind each itemId.
    void this.session.load().catch(() => undefined);
  }

  async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const parsed: ResultFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const data = JSON.parse(await file.text()) as ResultFile;
        if (!Array.isArray(data.choices)) throw new Error('missing choices');
        parsed.push(data);
      } catch {
        errors.push(`${file.name}: not a valid result file`);
      }
    }

    // Merge with any already-loaded runs, de-duplicating identical files.
    const seen = new Set(
      this.results().map((r) => `${r.participant}|${r.language}|${r.startedAt}`),
    );
    const merged = [...this.results()];
    for (const r of parsed) {
      const id = `${r.participant}|${r.language}|${r.startedAt}`;
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(r);
      }
    }
    this.results.set(merged);
    this.errors.set(errors);
    input.value = '';
  }

  clear(): void {
    this.results.set([]);
    this.errors.set([]);
  }

  pct(part: number, total: number): string {
    return total ? `${Math.round((part / total) * 100)}%` : '—';
  }

  /** AI win rate, counting "both are good" ties as AI wins. */
  aiWinRate(t: Tally): string {
    return this.pct(t.ai + t.tie, t.total);
  }

  /** AI win rate as a number 0–100, for bar widths. */
  aiWinNum(t: Tally): number {
    return t.total ? Math.round(((t.ai + t.tie) / t.total) * 100) : 0;
  }

  /** Color band for a win rate: good / mid / bad. */
  winClass(t: Tally): string {
    if (!t.total) return '';
    const p = this.aiWinNum(t);
    if (p >= 55) return 'good';
    if (p <= 45) return 'bad';
    return 'mid';
  }

  private group(keyFn: (r: ResultFile) => string): Tally[] {
    const map = new Map<string, ResultFile[]>();
    for (const r of this.results()) {
      const key = keyFn(r);
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()]
      .map(([key, runs]) => this.tally(runs, key))
      .sort((a, b) => b.total - a.total);
  }

  private tally(runs: ResultFile[], key: string): Tally {
    let total = 0;
    let ai = 0;
    let tie = 0;
    for (const run of runs) {
      for (const c of run.choices) {
        total++;
        if (c.chosen === 'ai') ai++;
        else if (c.chosen === 'tie') tie++;
      }
    }
    return { key, total, ai, agency: total - ai - tie, tie };
  }
}
