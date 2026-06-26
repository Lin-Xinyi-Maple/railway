import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  message = signal('');
  private timer?: number;

  show(message: string) {
    if (this.timer) window.clearTimeout(this.timer);
    this.message.set(message);
    this.timer = window.setTimeout(() => {
      this.message.set('');
      this.timer = undefined;
    }, 2600);
  }
}
