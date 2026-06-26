import { CurrencyPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../models/domain';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <article class="product-card compact-product-card">
      <a [routerLink]="['/products', product.id]" class="product-card-image">
        <img [src]="product.main_image || fallbackImage" [alt]="product.name">
      </a>
      <div>
        <div class="product-card-top">
          <span class="badge" [class.self]="product.shop_type === 'self'">
            {{ product.shop_type === 'self' ? '平台自营' : '普通商家' }}
          </span>
          <small>{{ product.category_name }}</small>
        </div>
        <h3><a [routerLink]="['/products', product.id]">{{ product.name }}</a></h3>
        <p>{{ product.origin }} · {{ product.planting_method || '标准种植' }}</p>
        <a class="shop-link" [routerLink]="['/shops', product.shop_id]">{{ product.shop_name || '鲜域自营仓' }}</a>
        <div class="product-stats">
          <span>{{ product.order_users_count || 0 }} 人下单</span>
          <span>{{ product.paid_users_count || 0 }} 人付款</span>
          <span>{{ product.comment_count || 0 }} 条评论</span>
        </div>
        <div class="card-row">
          <strong>{{ product.price | currency:'CNY':'symbol-narrow' }}/{{ product.unit }}</strong>
          <a [routerLink]="['/products', product.id]">详情</a>
        </div>
      </div>
    </article>
  `
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
}
