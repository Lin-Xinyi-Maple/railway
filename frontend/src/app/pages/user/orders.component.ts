import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, map, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Order } from '../../models/domain';

const titles: Record<string, string> = {
  all: '全部订单',
  paid: '已付款订单',
  aftersale: '售后订单',
  '待付款': '待付款',
  '待收货': '待收货',
  '已收货': '已收货',
  '售后中': '售后中',
  '完成售后': '完成售后'
};

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, RouterLink],
  template: `
    @if (view$ | async; as view) {
      <section class="page-head">
        <h1>{{ view.title }}</h1>
      </section>
      <section class="table panel">
        @for (order of view.items; track order.id) {
          <article class="order-row">
            <div>
              <a class="order-product-link" [routerLink]="['/orders', order.id, 'detail']">{{ order.product.name }}</a>
              <span>{{ order.order_no }} · {{ order.status }}</span>
              <small>发货：{{ order.shop.shipping_address }}</small>
              <small>收货：{{ order.receiver_full_address || '待选择地址' }}</small>
            </div>
            <strong class="order-amount">{{ order.total_amount | currency:'CNY':'symbol-narrow' }}</strong>
            <div class="order-actions">
              @if (order.status === '待付款') {
                <button class="solid" (click)="pay(order.id)">去付款</button>
                <button class="ghost danger-text" type="button" (click)="deleteOrder(order.id)">删除</button>
              } @else if (order.status === '待收货') {
                <button class="solid" type="button" (click)="receive(order.id)">已收货</button>
                <button class="ghost danger-text" type="button" (click)="deleteOrder(order.id)">删除</button>
              } @else if (order.status === '已收货') {
                <button class="solid" type="button" (click)="applyAfterSale(order)">申请售后</button>
                <button class="ghost danger-text" type="button" (click)="deleteOrder(order.id)">删除</button>
              } @else if (order.status === '售后中') {
                <button class="solid" type="button" (click)="completeAfterSale(order.id)">已完成</button>
                <button class="ghost danger-text" type="button" (click)="deleteOrder(order.id)">删除</button>
              } @else {
                <button class="ghost danger-text" type="button" (click)="deleteOrder(order.id)">删除</button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty">当前分类暂无订单</div>
        }
      </section>
    }
  `
})
export class OrdersComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reload$ = new Subject<void>();
  orders$ = this.reload$.pipe(startWith(undefined), switchMap(() => this.api.orders()));
  view$ = combineLatest([this.orders$, this.route.queryParamMap]).pipe(
    map(([page, params]) => {
      const filter = params.get('filter') || 'all';
      const items = page.items.filter(order => this.matchesFilter(order, filter));
      return { title: titles[filter] || '全部订单', items };
    })
  );

  pay(id: number) {
    this.router.navigate(['/orders', id, 'pay']);
  }

  receive(id: number) {
    this.api.receiveOrder(id).subscribe(() => {
      this.toast.show('已确认收货');
      this.reload$.next();
    });
  }

  applyAfterSale(order: Order) {
    this.api.applyAfterSale(order.id).subscribe(updated => {
      this.toast.show('已进入售后，请和商家沟通');
      const merchantId = updated.product?.merchant_account_id || order.product?.merchant_account_id;
      if (merchantId) {
        this.router.navigate(['/messages', `sender-${merchantId}`], { queryParams: { name: updated.shop?.name || order.shop?.name } });
      } else {
        this.reload$.next();
      }
    });
  }

  completeAfterSale(id: number) {
    this.api.completeAfterSale(id).subscribe(() => {
      this.toast.show('售后已完成');
      this.reload$.next();
    });
  }

  deleteOrder(id: number) {
    this.api.deleteOrder(id).subscribe(() => {
      this.toast.show('订单已删除');
      this.reload$.next();
    });
  }

  private matchesFilter(order: Order, filter: string) {
    if (filter === 'all') return true;
    if (filter === 'paid') return order.status !== '待付款';
    if (filter === 'aftersale') return order.status === '售后中' || order.status === '完成售后';
    return order.status === filter;
  }
}
