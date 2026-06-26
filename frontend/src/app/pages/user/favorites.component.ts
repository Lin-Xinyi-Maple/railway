import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  template: `
    <section class="page-head">
      <h1>我的收藏</h1>
    </section>

    @if (favorites$ | async; as favorites) {
      <section class="panel favorite-list">
        @for (item of favorites; track item.id) {
          <article class="favorite-row">
            <img [src]="item.product.main_image || fallbackImage" [alt]="item.product.name">
            <div>
              <strong><a [routerLink]="['/products', item.product.id]">{{ item.product.name }}</a></strong>
              <span>收藏时间：{{ item.created_at | date:'yyyy-MM-dd HH:mm:ss' }}</span>
            </div>
            <button class="ghost danger-text" type="button" (click)="remove(item.id)">删除</button>
          </article>
        } @empty {
          <div class="empty">暂无收藏商品</div>
        }
      </section>
    }
  `
})
export class FavoritesComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private reload$ = new Subject<void>();
  fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
  favorites$ = this.reload$.pipe(startWith(undefined), switchMap(() => this.api.favorites()));

  remove(id: number) {
    this.api.deleteFavoriteItem(id).subscribe(() => {
      this.toast.show('收藏已删除');
      this.reload$.next();
    });
  }
}
