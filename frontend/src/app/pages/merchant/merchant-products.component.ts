import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, map, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Product } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, RouterLink],
  template: `
    <section class="page-head dashboard-head">
      <div>
        <a class="back-link" routerLink="/merchant/profile">返回我的</a>
        <h1>修改商品</h1>
      </div>
      <a class="solid" routerLink="/merchant/products/new">发布商品</a>
    </section>

    @if (products$ | async; as products) {
      <section class="panel data-detail-page">
        @for (product of products; track product.id) {
          <article class="data-list-row rich-row merchant-product-row" [class.muted-row]="product.status === 'disabled'">
            <img [src]="product.main_image || fallbackImage" [alt]="product.name">
            <div>
              <strong>{{ product.name }}</strong>
              <span>{{ statusLabel(product.status) }} · 库存 {{ product.stock }} · {{ product.price | currency:'CNY':'symbol-narrow' }}/{{ product.unit }}</span>
            </div>
            <div class="row-actions">
              @if (product.status === 'off_sale') {
                <button class="ghost" type="button" (click)="changeStatus(product, 'on_sale')">重新上架</button>
              } @else if (product.status === 'on_sale') {
                <button class="ghost" type="button" (click)="changeStatus(product, 'off_sale')">下架</button>
              }
              @if (product.status !== 'disabled') {
                <a class="ghost" [routerLink]="['/merchant/products', product.id, 'edit']">编辑</a>
                <button class="ghost danger-text" type="button" (click)="remove(product)">删除</button>
              }
            </div>
          </article>
        } @empty { <div class="empty">暂无商品</div> }
      </section>
    }
  `
})
export class MerchantProductsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private reload$ = new BehaviorSubject(0);
  fallbackImage = 'assets/poster-apple.png';
  products$ = this.reload$.pipe(
    switchMap(() => this.api.merchantSummary('week')),
    map(summary => summary.product_list || [])
  );

  statusLabel(status: string) {
    return status === 'on_sale' ? '在售' : status === 'off_sale' ? '已下架' : '已封禁';
  }

  changeStatus(product: Product, status: 'on_sale' | 'off_sale') {
    this.api.updateProduct(product.id, { status }).subscribe(() => {
      this.toast.show(status === 'on_sale' ? '商品已重新上架' : '商品已下架');
      this.reload$.next(Date.now());
    });
  }

  remove(product: Product) {
    if (!window.confirm(`确定删除 ${product.name} 吗？`)) return;
    this.api.deleteProduct(product.id).subscribe(() => {
      this.toast.show('商品已删除');
      this.reload$.next(Date.now());
    });
  }
}
