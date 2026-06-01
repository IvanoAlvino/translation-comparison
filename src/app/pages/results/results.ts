import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ResultFile } from '../../models';
import { SessionService } from '../../session.service';

@Component({
  selector: 'app-results',
  imports: [],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results implements OnInit {
  readonly result = signal<ResultFile | null>(null);
  readonly downloaded = signal(false);

  constructor(
    private readonly session: SessionService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.session.complete()) {
      this.router.navigate(['/']);
      return;
    }
    this.result.set(this.session.buildResult());
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'anon';
  }

  download(): void {
    const result = this.result();
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result-${result.language}-${this.slug(result.participant)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.downloaded.set(true);
  }

  restart(): void {
    this.router.navigate(['/']);
  }
}
