import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="page-head detail-head">
      <div>
        <a class="back-link" routerLink="/merchant/profile">返回我的</a>
        <h1>售后订单</h1>
      </div>
    </section>

    <section class="panel data-detail-page">
      <div class="list-toolbar aftersale-toolbar">
        <input [(ngModel)]="keyword" (ngModelChange)="reload()" placeholder="按照订单号搜索">
      </div>

      @if (orders$ | async; as page) {
        @for (order of page.items; track order.id) {
          <article class="data-list-row rich-row aftersale-row">
            <img [src]="order.product.main_image || fallbackImage" [alt]="order.product.name">
            <div>
              <strong>{{ order.order_no }}</strong>
              <span>{{ order.product.name }} · {{ order.user?.nickname || '-' }} · {{ order.status }}</span>
              <small>{{ order.created_at | date:'yyyy-MM-dd HH:mm' }}</small>
            </div>
            <em>{{ order.total_amount | currency:'CNY':'symbol-narrow' }}</em>
          </article>
        } @empty {
          <div class="empty">暂无售后订单</div>
        }
      }
    </section>
  `
})
export class MerchantAfterSalesComponent {
  private api = inject(ApiService);
  private reload$ = new BehaviorSubject(0);
  fallbackImage = 'assets/poster-apple.png';
  keyword = '';
  orders$ = this.reload$.pipe(switchMap(() => this.api.merchantAfterSales(this.keyword.trim())));

  reload() {
    this.reload$.next(Date.now());
  }
}
