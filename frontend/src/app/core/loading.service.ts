import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pending = signal(0);
  visible = computed(() => this.pending() > 0);

  show() {
    this.pending.update(value => value + 1);
  }

  hide() {
    this.pending.update(value => Math.max(0, value - 1));
  }
}
