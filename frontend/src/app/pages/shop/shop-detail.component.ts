import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, RouterLink, ProductCardComponent],
  template: `
    @if (shop$ | async; as shop) {
      <section class="shop-profile panel">
        <div>
          <span class="badge" [class.self]="shop.type === 'self'">{{ shop.type === 'self' ? '平台自营' : '普通商家' }}</span>
          <h1>{{ shop.name }}</h1>
          <p>{{ shop.description || '这家店铺暂未填写介绍。' }}</p>
        </div>
        <dl>
          <div><dt>联系电话</dt><dd>{{ shop.phone }}</dd></div>
          <div><dt>发货地址</dt><dd>{{ shop.shipping_address }}</dd></div>
          <div><dt>商品数量</dt><dd>{{ shop.products_count || 0 }}</dd></div>
          <div><dt>成交订单</dt><dd>{{ shop.paid_orders_count || 0 }}</dd></div>
          <div><dt>成交金额</dt><dd>{{ shop.paid_amount || 0 | currency:'CNY':'symbol-narrow' }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ shop.created_at | date:'yyyy-MM-dd HH:mm' }}</dd></div>
        </dl>
      </section>

      <section class="page-head">
        <h1>店铺商品</h1>
      </section>
      <section class="product-grid">
        @for (product of shop.products || []; track product.id) {
          <app-product-card [product]="product" />
        } @empty {
          <div class="empty panel">暂无在售商品</div>
        }
      </section>
      <a class="ghost back-link" routerLink="/shop">返回推荐</a>
    }
  `
})
export class ShopDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  shop$ = this.route.paramMap.pipe(switchMap(params => this.api.shop(Number(params.get('id')))));
}
