import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Product } from '../../models/domain';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    @if (product(); as item) {
      <section class="detail">
        <div class="detail-gallery">
          <div class="gallery-track" [style.transform]="'translateX(-' + activeImageIndex() * 100 + '%)'">
            @for (image of displayImages(item); track image) {
              <img class="detail-image" [src]="image" [alt]="item.name">
            }
          </div>
          @if (galleryImages(item).length > 1) {
            <button class="gallery-nav prev" type="button" (click)="moveImage(item, -1)">‹</button>
            <button class="gallery-nav next" type="button" (click)="moveImage(item, 1)">›</button>
            <div class="gallery-dots">
              @for (image of galleryImages(item); track image; let index = $index) {
                <button type="button" [class.active]="index === activeImageIndex()" (click)="activeImageIndex.set(index)"></button>
              }
            </div>
          }
        </div>
        <div class="panel detail-panel">
          <span class="badge" [class.self]="item.shop_type === 'self'">{{ item.shop_type === 'self' ? '平台自营商家' : '普通商家' }}</span>
          <h1>{{ item.name }}</h1>
          <p class="muted">
            @if (item.shop_type !== 'self') {
              <a class="shop-link" [routerLink]="['/shops', item.shop_id]">{{ item.shop_name }}</a>
            } @else {
              {{ item.shop_name }}
            }
            · {{ item.category_name }} · {{ item.origin }}
          </p>
          <p>{{ item.detail }}</p>
          <div class="specs">
            <span>种植方式：{{ item.planting_method || '标准种植' }}</span>
            <span>库存：{{ item.stock }} {{ item.unit }}</span>
            <span>保质期：{{ item.shelf_life_days }} 天</span>
            <span>储存：{{ item.storage_condition }}</span>
          </div>
          <strong class="price">{{ item.price | currency:'CNY':'symbol-narrow' }}/{{ item.unit }}</strong>
          <div class="quantity-row">
            <span>购买数量</span>
            <button type="button" class="ghost quantity-btn" (click)="setQuantity(quantity() - 1)">-</button>
            <input type="number" min="1" [max]="item.stock" [value]="quantity()" (input)="setQuantity($any($event.target).value)">
            <button type="button" class="ghost quantity-btn" (click)="setQuantity(quantity() + 1)">+</button>
          </div>
          <div class="total-row">
            <span>总价</span>
            <strong>{{ item.price * quantity() | currency:'CNY':'symbol-narrow' }}</strong>
          </div>
          <div class="actions product-actions" [class.customer-actions-disabled]="isBusinessAccount()">
            <button class="solid buy-now customer-only" type="button" [disabled]="isBusinessAccount()" (click)="buyNow(item.id)">立即购买</button>
            <button class="ghost" type="button" (click)="runReview(item.id)">AI监管</button>
            <button class="ghost" type="button" (click)="openAiChat(item.id)">AI智能客服</button>
            <button class="ghost customer-only" type="button" [disabled]="isBusinessAccount()" (click)="addCart(item.id)">加入购物车</button>
          </div>
          <div class="product-secondary-actions" [class.customer-actions-disabled]="isBusinessAccount()">
            <a class="ghost comment-entry" [routerLink]="['/products', item.id, 'comments']">
              <span>查看商品评价</span>
            </a>
            <a class="ghost customer-only" [routerLink]="['/shops', item.shop_id]">商家详情</a>
            <button class="ghost customer-only" type="button" [disabled]="isBusinessAccount()" (click)="openMerchantChat(item)">商家客服</button>
            <button class="ghost favorite-action customer-only" type="button" [disabled]="isBusinessAccount()" [class.active]="item.is_favorite" (click)="toggleFavorite(item)">
              {{ item.is_favorite ? '已收藏' : '收藏' }}
            </button>
          </div>
        </div>
      </section>
    }

    @if (reviewModalOpen()) {
      <div class="modal-backdrop" (click)="closeReview()">
        <section class="ai-review-modal panel" (click)="$event.stopPropagation()">
          <button class="modal-close" type="button" (click)="closeReview()">×</button>
          <header>
            <img src="assets/about/logo.png" alt="DeepSeek">
            <div>
              <span>DEEPSEEK AI 监管</span>
              <h2>商品宣传可信度检测</h2>
            </div>
          </header>
          @if (reviewLoading()) {
            <p class="muted">正在分析商品信息...</p>
          } @else if (review(); as result) {
            <strong class="score">{{ result.score }} 分</strong>
            <p>{{ result.conclusion }}</p>
          }
        </section>
      </div>
    }
  `
})
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  fallbackImage = 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80';
  product = signal<Product | null>(null);
  quantity = signal(1);
  activeImageIndex = signal(0);
  review = signal<{ product_id?: number; score: number; conclusion: string; created_at?: string } | null>(null);
  reviewModalOpen = signal(false);
  reviewLoading = signal(false);

  constructor() {
    this.route.paramMap.pipe(switchMap(params => this.api.product(Number(params.get('id'))))).subscribe(item => {
      this.product.set(item);
      this.setQuantity(1);
      this.activeImageIndex.set(0);
    });
  }

  setQuantity(value: number | string) {
    const stock = this.product()?.stock || 1;
    const next = Math.max(1, Math.min(Number(value) || 1, stock));
    this.quantity.set(next);
  }

  isBusinessAccount() {
    return this.auth.role() === 'merchant' || this.auth.role() === 'admin';
  }

  buyNow(id: number) {
    if (!this.canUseCustomerActions()) return;
    this.api.createOrder(id, undefined, this.quantity()).subscribe(order => {
      this.toast.show('订单已创建，请完成付款');
      this.router.navigate(['/orders', order.id, 'pay']);
    });
  }

  addCart(id: number) {
    if (!this.canUseCustomerActions()) return;
    this.api.addToCart(id, this.quantity()).subscribe(() => this.toast.show('已加入购物车'));
  }

  toggleFavorite(item: Product) {
    if (!this.canUseCustomerActions()) return;
    const request$ = item.is_favorite ? this.api.unfavoriteProduct(item.id) : this.api.favoriteProduct(item.id);
    request$.subscribe(() => {
      const next = { ...item, is_favorite: !item.is_favorite };
      this.product.set(next);
      this.toast.show(next.is_favorite ? '已收藏商品' : '已取消收藏');
    });
  }

  openMerchantChat(item: Product) {
    if (!this.canUseCustomerActions()) return;
    if (!item.merchant_account_id) {
      this.toast.show('商家账号不存在');
      return;
    }
    this.router.navigate(['/messages', `sender-${item.merchant_account_id}`], { queryParams: { name: item.shop_name } });
  }

  openAiChat(id: number) {
    if (!this.canUseAuthenticatedActions()) return;
    this.router.navigate(['/products', id, 'ai-chat']);
  }

  galleryImages(item: Product) {
    return [item.main_image, item.image_2, item.image_3].filter(Boolean) as string[];
  }

  displayImages(item: Product) {
    const images = this.galleryImages(item);
    return images.length ? images : [this.fallbackImage];
  }

  moveImage(item: Product, offset: number) {
    const images = this.galleryImages(item);
    if (!images.length) return;
    this.activeImageIndex.update(index => (index + offset + images.length) % images.length);
  }

  runReview(id: number) {
    if (!this.canUseAuthenticatedActions()) return;
    this.reviewModalOpen.set(true);
    this.reviewLoading.set(true);
    this.review.set(null);
    this.api.aiReview(id).subscribe({
      next: result => this.review.set(result),
      error: () => this.toast.show('AI监管暂时不可用，请稍后再试'),
      complete: () => this.reviewLoading.set(false)
    });
  }

  closeReview() {
    this.reviewModalOpen.set(false);
  }

  private canUseCustomerActions() {
    if (!this.canUseAuthenticatedActions()) {
      return false;
    }
    if (this.isBusinessAccount()) {
      this.toast.show('此功能仅普通用户可用');
      return false;
    }
    return true;
  }

  private canUseAuthenticatedActions() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/login');
      return false;
    }
    return true;
  }
}
