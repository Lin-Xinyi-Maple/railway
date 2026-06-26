import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, map, shareReplay, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { CartItem } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, RouterLink],
  template: `
    <section class="page-head">
      <h1>购物车</h1>
    </section>

    @if (view$ | async; as view) {
      <section class="panel cart-list">
        @for (item of view.items; track item.id) {
          <article class="cart-row cart-row-actions">
            <img [src]="item.product.main_image || fallbackImage" [alt]="item.product.name">
            <div class="cart-product-copy">
              <strong>{{ item.product.name }}</strong>
              <span>{{ item.product.shop_name }} · {{ item.product.origin }}</span>
            </div>
            <span class="cart-quantity">x {{ item.quantity }}</span>
            <strong class="cart-line-total">{{ lineTotal(item) | currency:'CNY':'symbol-narrow' }}</strong>
            <div class="cart-actions-left">
              <button class="solid tiny-action" type="button" (click)="buyNow(item)">立即购买</button>
              <a class="ghost tiny-action" [routerLink]="['/products', item.product.id]">查看商品</a>
              <button class="ghost danger-text tiny-action" type="button" (click)="remove(item.id)">删除</button>
            </div>
          </article>
        } @empty {
          <div class="empty">购物车里还没有商品</div>
        }
        <footer>
          <span>合计</span>
          <strong>{{ view.total | currency:'CNY':'symbol-narrow' }}</strong>
        </footer>
      </section>
    }
  `
})
export class CartComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private reload$ = new Subject<void>();
  fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';

  view$ = this.reload$.pipe(
    startWith(undefined),
    switchMap(() => this.api.cart()),
    map(items => ({
      items,
      total: items.reduce((sum, item) => sum + this.lineTotal(item), 0)
    })),
    shareReplay(1)
  );

  buyNow(item: CartItem) {
    this.api.createOrder(item.product.id, undefined, Number(item.quantity)).subscribe(order => {
      this.toast.show('订单已创建，请完成付款');
      this.router.navigate(['/orders', order.id, 'pay']);
    });
  }

  lineTotal(item: CartItem) {
    return Number(item.line_total ?? Number(item.product.price) * Number(item.quantity));
  }

  remove(itemId: number) {
    this.api.deleteCartItem(itemId).subscribe(() => {
      this.toast.show('已删除购物车记录');
      this.reload$.next();
    });
  }
}
