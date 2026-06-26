import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <section class="page-head">
      <h1>我的评价</h1>
    </section>

    @if (orders$ | async; as orders) {
      <section class="panel review-order-list">
        @for (order of orders; track order.id) {
          <article class="review-order-row">
            <img [src]="order.product.main_image || fallbackImage" [alt]="order.product.name">
            <div>
              <a class="order-product-link" [routerLink]="['/orders', order.id, 'detail']">{{ order.product.name }}</a>
              <span>{{ order.shop.name }} · {{ order.created_at | date:'yyyy-MM-dd HH:mm' }}</span>
            </div>
            <span>x {{ order.quantity }}</span>
            <span>{{ order.unit_price | currency:'CNY':'symbol-narrow' }}/{{ order.product.unit }}</span>
            <strong>{{ order.total_amount | currency:'CNY':'symbol-narrow' }}</strong>
            <a class="solid" [routerLink]="['/products', order.product.id, 'comments']">去评价</a>
          </article>
        } @empty {
          <div class="empty">暂无可评价商品</div>
        }
      </section>
    }
  `
})
export class ReviewsComponent {
  private api = inject(ApiService);
  fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
  orders$ = this.api.reviewableOrders();
}
