import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LanguageData } from '../../models';
import { SessionService } from '../../session.service';

@Component({
  selector: 'app-landing',
  imports: [FormsModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements OnInit {
  name = '';
  languageCode = '';
  readonly error = signal('');
  readonly loading = signal(true);

  constructor(
    protected readonly session: SessionService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.session.load();
    } catch {
      this.error.set('Could not load the translation set. Please contact the organizer.');
    } finally {
      this.loading.set(false);
    }
  }

  get canStart(): boolean {
    return this.name.trim().length > 0 && this.languageCode.length > 0;
  }

  start(): void {
    const language = this.session
      .languages()
      .find((l: LanguageData) => l.code === this.languageCode);
    if (!language || !this.canStart) return;
    this.session.start(this.name, language);
    this.router.navigate(['/exercise']);
  }
}
