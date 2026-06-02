import { Component, computed, input } from '@angular/core';
import { renderMessage } from '../../icu';

/**
 * Renders a translation string for review: placeholders as chips, ICU plural/select
 * blocks expanded into one labelled line per branch.
 */
@Component({
  selector: 'app-message',
  imports: [],
  templateUrl: './message.html',
  styleUrl: './message.css',
})
export class Message {
  readonly text = input<string>('');
  readonly rendered = computed(() => renderMessage(this.text()));
}
