import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Order, Product } from '../../models/domain';

type MerchantPanel = 'products' | 'orders' | 'stock' | 'sales';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  template: `
    @if (view$ | async; as view) {
      <section class="page-head detail-head">
        <div>
          <a class="back-link" routerLink="/merchant">返回商家数据</a>
          <h1>{{ title(view.panel) }}</h1>
        </div>
      </section>

      <section class="panel data-detail-page">
        @if (view.panel === 'orders' || view.panel === 'sales') {
          <div class="list-toolbar">
            <input [(ngModel)]="orderKeyword" placeholder="按照订单号搜索">
          </div>
        }

        @switch (view.panel) {
          @case ('products') {
            @for (product of view.summary.product_list || []; track product.id) {
              <article class="data-list-row rich-row" [class.muted-row]="product.status !== 'on_sale'">
                <img [src]="product.main_image || fallbackImage" [alt]="product.name">
                <div>
                  <strong>{{ product.name }}</strong>
                  <span>{{ statusLabel(product.status) }} · 库存 {{ product.stock }} · 警戒 {{ product.warning_stock }}</span>
                </div>
                <em>{{ product.price | currency:'CNY':'symbol-narrow' }}/{{ product.unit }}</em>
              </article>
            } @empty { <div class="empty">暂无商品</div> }
          }
          @case ('orders') {
            @for (order of filteredOrders(view.summary.order_list || []); track order.id) {
              <article class="data-list-row rich-row">
                <img [src]="order.product.main_image || fallbackImage" [alt]="order.product.name">
                <div>
                  <strong>{{ order.product.name }}</strong>
                  <span>{{ order.order_no }} · {{ order.paid_at | date:'yyyy-MM-dd HH:mm' }}</span>
                </div>
                <em>{{ order.total_amount | currency:'CNY':'symbol-narrow' }}</em>
              </article>
            } @empty { <div class="empty">暂无成交订单</div> }
          }
          @case ('stock') {
            @for (product of view.summary.product_list || []; track product.id) {
              <article class="data-list-row rich-row stock-row" [class.muted-row]="product.status !== 'on_sale'">
                <img [src]="product.main_image || fallbackImage" [alt]="product.name">
                <div>
                  <strong>{{ product.name }}</strong>
                  <span>现有库存 {{ product.stock }} · 警戒库存 {{ product.warning_stock }} · {{ statusLabel(product.status) }}</span>
                </div>
                <button class="ghost" type="button" (click)="restock(product)">补货</button>
              </article>
            } @empty { <div class="empty">暂无库存数据</div> }
          }
          @case ('sales') {
            @for (order of filteredOrders(view.summary.income_details || []); track order.id) {
              <article class="data-list-row rich-row">
                <img [src]="order.product.main_image || fallbackImage" [alt]="order.product.name">
                <div>
                  <strong>{{ order.product.name }}</strong>
                  <span>{{ order.order_no }} · {{ order.paid_at | date:'yyyy-MM-dd HH:mm' }}</span>
                </div>
                <em>{{ order.total_amount | currency:'CNY':'symbol-narrow' }}</em>
              </article>
            } @empty { <div class="empty">暂无收入明细</div> }
          }
        }
      </section>
    }
  `
})
export class MerchantDataDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private reload$ = new BehaviorSubject(0);
  fallbackImage = 'assets/poster-apple.png';
  orderKeyword = '';
  view$ = combineLatest([
    this.route.paramMap.pipe(map(params => (params.get('panel') || 'products') as MerchantPanel)),
    this.reload$
  ]).pipe(
    switchMap(([panel]) => this.api.merchantSummary('week').pipe(map(summary => ({ panel, summary }))))
  );

  title(panel: MerchantPanel) {
    return ({ products: '商品状态', orders: '成交订单', stock: '库存预警', sales: '收入明细' })[panel] || '商家数据';
  }

  subtitle(panel: MerchantPanel) {
    return ({
      products: '查看该店铺全部商品，在售商品正常显示，下架和封禁商品灰色显示。',
      orders: '这里只展示该店铺除待付款之外的成交订单。',
      stock: '显示该店铺全部商品的现有库存和警戒库存。',
      sales: '按订单展示该店铺所有非待付款订单收入。'
    })[panel] || '';
  }

  statusLabel(status: string) {
    return status === 'on_sale' ? '在售' : status === 'off_sale' ? '下架' : '封禁';
  }

  filteredOrders(orders: Order[]) {
    const keyword = this.orderKeyword.trim();
    return keyword ? orders.filter(order => order.order_no.includes(keyword)) : orders;
  }

  restock(product: Product) {
    const raw = window.prompt(`请输入 ${product.name} 的补货数量`, '1');
    if (raw === null) return;
    const quantity = Math.floor(Number(raw));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.toast.show('补货数量必须大于 0');
      return;
    }
    this.api.restockProduct(product.id, quantity).subscribe(() => {
      this.toast.show('补货成功');
      this.reload$.next(Date.now());
    });
  }
}
