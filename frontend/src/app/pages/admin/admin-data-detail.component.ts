import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Account, Order, Product, Shop } from '../../models/domain';

type AdminPanel = 'buyers' | 'shops' | 'products' | 'orders';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, FormsModule, RouterLink],
  template: `
    @if (view$ | async; as view) {
      <section class="page-head detail-head">
        <div>
          <a class="back-link" routerLink="/admin">返回自营管理</a>
          <h1>{{ title(view.panel) }}</h1>
        </div>
      </section>

      <section class="panel data-detail-page">
        <div class="list-toolbar">
          <input [(ngModel)]="keyword" [placeholder]="searchPlaceholder(view.panel)">
        </div>

        @switch (view.panel) {
          @case ('buyers') {
            @for (account of filteredBuyers(view.summary.buyers || []); track account.id) {
              <article class="admin-list-row rich-row" [class.muted-row]="account.status === 'disabled'">
                @if (account.avatar) { <img [src]="account.avatar" [alt]="account.nickname"> } @else { <span>{{ account.nickname.slice(0, 1) }}</span> }
                <div><strong>{{ account.nickname }}</strong><small>{{ account.username }} · {{ account.email }} · {{ account.status }}</small></div>
                <button class="ghost" type="button" (click)="toggleAccount(account)">{{ account.status === 'active' ? '封禁' : '解禁' }}</button>
              </article>
            } @empty { <div class="empty">暂无买家账号</div> }
          }
          @case ('shops') {
            @for (shop of filteredShops(view.summary.merchant_shops || []); track shop.id) {
              <article class="admin-list-row rich-row" [class.muted-row]="shop.status === 'disabled'">
                <span>店</span>
                <div><strong>{{ shop.name }}</strong><small>{{ shop.owner?.nickname }} · {{ shop.phone }} · {{ shop.status }}</small></div>
                <div class="row-actions admin-shop-actions">
                  <button class="ghost tiny-action" type="button" (click)="toggleShop(shop)">{{ shop.status === 'active' ? '封禁' : '解禁' }}</button>
                  <button class="ghost danger-text tiny-action" type="button" (click)="deleteShop(shop)">删除</button>
                </div>
              </article>
            } @empty { <div class="empty">暂无店铺</div> }
          }
          @case ('products') {
            @for (product of filteredProducts(view.summary.product_list || []); track product.id) {
              <article class="admin-list-row rich-row" [class.muted-row]="product.status !== 'on_sale'">
                <img [src]="product.main_image || fallbackImage" [alt]="product.name">
                <div><strong>{{ product.name }}</strong><small>{{ product.shop_name }} · {{ product.status }} · 库存 {{ product.stock }}</small></div>
                <button class="ghost" type="button" (click)="toggleProduct(product)">{{ product.status === 'disabled' ? '解禁' : '封禁' }}</button>
              </article>
            } @empty { <div class="empty">暂无商品</div> }
          }
          @case ('orders') {
            @for (order of filteredOrders(view.summary.order_list || []); track order.id) {
              <article class="admin-list-row rich-row order-admin-row">
                <img [src]="order.product.main_image || fallbackImage" [alt]="order.product.name">
                <div>
                  <strong>{{ order.order_no }}</strong>
                  <small>{{ order.user?.nickname || '-' }} · {{ order.shop.name }} · {{ order.status }}</small>
                </div>
                <em>{{ order.total_amount | currency:'CNY':'symbol-narrow' }}</em>
              </article>
            } @empty { <div class="empty">暂无订单</div> }
          }
        }
      </section>
    }
  `
})
export class AdminDataDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private reload$ = new BehaviorSubject(0);
  fallbackImage = 'assets/poster-apple.png';
  keyword = '';
  view$ = combineLatest([
    this.route.paramMap.pipe(map(params => (params.get('panel') || 'buyers') as AdminPanel)),
    this.reload$
  ]).pipe(
    switchMap(([panel]) => this.api.adminSummary('week').pipe(map(summary => ({ panel, summary }))))
  );

  title(panel: AdminPanel) {
    return ({ buyers: '买家账号', shops: '店铺', products: '商品状态', orders: '全部订单' })[panel] || '自营管理';
  }

  subtitle(panel: AdminPanel) {
    return ({
      buyers: '各种状态的普通用户都会显示，被封禁账号黑白显示。',
      shops: '这里不统计自营店铺，只展示普通商家店铺。',
      products: '平台商品按状态展示，只有在售商品会展示给普通用户。',
      orders: '平台全部订单，付款和未付款都会显示。'
    })[panel] || '';
  }

  searchPlaceholder(panel: AdminPanel) {
    return ({ buyers: '按照邮箱搜索', shops: '按照店名搜索', products: '按照商品名称搜索', orders: '按照订单号搜索' })[panel];
  }

  filteredBuyers(items: Account[]) {
    const keyword = this.keyword.trim().toLowerCase();
    return keyword ? items.filter(item => item.email.toLowerCase().includes(keyword)) : items;
  }

  filteredShops(items: Shop[]) {
    const keyword = this.keyword.trim();
    return keyword ? items.filter(item => item.name.includes(keyword)) : items;
  }

  filteredProducts(items: Product[]) {
    const keyword = this.keyword.trim();
    return keyword ? items.filter(item => item.name.includes(keyword)) : items;
  }

  filteredOrders(items: Order[]) {
    const keyword = this.keyword.trim();
    return keyword ? items.filter(item => item.order_no.includes(keyword)) : items;
  }

  toggleAccount(account: Account) {
    this.api.updateAccountStatus(account.id, account.status === 'active' ? 'disabled' : 'active').subscribe(() => this.reload('账号状态已更新'));
  }

  toggleShop(shop: Shop) {
    this.api.updateShopStatus(shop.id, shop.status === 'active' ? 'disabled' : 'active').subscribe(() => this.reload('店铺状态已更新'));
  }

  deleteShop(shop: Shop) {
    if (!window.confirm(`确认删除店铺「${shop.name}」？店铺下的商品、订单、购物车、收藏和评论都会一起删除。`)) return;
    this.api.deleteShop(shop.id).subscribe(() => this.reload('店铺及关联记录已删除'));
  }

  toggleProduct(product: Product) {
    this.api.updateProductStatus(product.id, product.status === 'disabled' ? 'on_sale' : 'disabled').subscribe(() => this.reload('商品状态已更新'));
  }

  private reload(message: string) {
    this.toast.show(message);
    this.reload$.next(Date.now());
  }
}
