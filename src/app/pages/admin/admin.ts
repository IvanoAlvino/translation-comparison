import { Component, computed, signal } from '@angular/core';
import { ResultFile } from '../../models';

interface Tally {
  key: string;
  total: number;
  ai: number;
  agency: number;
  tie: number;
}

@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
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
