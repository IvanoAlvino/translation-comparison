import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../session.service';

@Component({
  selector: 'app-exercise',
  imports: [],
  templateUrl: './exercise.html',
  styleUrl: './exercise.css',
})
export class Exercise implements OnInit {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly current = this.session.current;

  /** Text to show on each side, derived from the hidden side assignment. */
  readonly leftText = computed(() => {
    const c = this.current();
    if (!c) return '';
    return c.leftWas === 'agency' ? c.item.agency : c.item.ai;
  });
  readonly rightText = computed(() => {
    const c = this.current();
    if (!c) return '';
    return c.leftWas === 'agency' ? c.item.ai : c.item.agency;
  });

  readonly position = computed(() => this.session.index() + 1);
  readonly progress = computed(() =>
    this.session.total() ? (this.session.index() / this.session.total()) * 100 : 0,
  );

  ngOnInit(): void {
    if (!this.session.hasSession()) {
      this.router.navigate(['/']);
    }
  }

  choose(pick: 'left' | 'right' | 'both'): void {
    this.session.choose(pick);
    if (this.session.complete()) {
      this.router.navigate(['/results']);
    }
  }
}
