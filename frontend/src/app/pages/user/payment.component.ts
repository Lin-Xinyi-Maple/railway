import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

type PayMethod = {
  value: string;
  label: string;
  icon: string;
};

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  template: `
    @if (view$ | async; as view) {
      <section class="payment-layout fixed-layout">
        <section class="panel payment-summary fixed-pane">
          <div class="section-title">
            <span>付</span>
            <div>
              <h1>订单付款</h1>
            </div>
          </div>
          <div class="payment-product">
            <img [src]="view.order.product.main_image || fallbackImage" [alt]="view.order.product.name">
            <div>
              <strong>{{ view.order.product.name }}</strong>
              <span>{{ view.order.product.shop_name }} · {{ view.order.product.origin }}</span>
            </div>
          </div>
          <dl>
            <div><dt>商家信息</dt><dd>{{ view.order.shop.name }} · {{ view.order.shop.type === 'self' ? '平台自营' : '普通商家' }}</dd></div>
            <div><dt>购买数量</dt><dd>x {{ view.order.quantity }}</dd></div>
            <div><dt>商品单价</dt><dd>{{ view.order.unit_price | currency:'CNY':'symbol-narrow' }}</dd></div>
            <div><dt>总金额</dt><dd>{{ view.order.total_amount | currency:'CNY':'symbol-narrow' }}</dd></div>
            <div><dt>订单号</dt><dd>{{ view.order.order_no }}</dd></div>
            <div><dt>创建时间</dt><dd>{{ view.order.created_at | date:'yyyy-MM-dd HH:mm:ss' }}</dd></div>
            <div><dt>订单状态</dt><dd>{{ view.order.status }}</dd></div>
          </dl>
        </section>

        <form class="panel payment-form scroll-pane" [formGroup]="form" (ngSubmit)="finishPay(view.order.id)">
          <h2>收货地址</h2>
          @if (view.addresses.length) {
            <div class="pay-addresses">
              @for (address of view.addresses; track address.id) {
                <label class="pay-address" [class.active]="form.value.address_id === address.id">
                  <input type="radio" formControlName="address_id" [value]="address.id">
                  <span>
                    <strong>{{ address.receiver_name }} · {{ address.phone }}</strong>
                    <small>{{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}</small>
                    @if (address.is_default) { <em>默认地址</em> }
                  </span>
                </label>
              }
            </div>
          } @else {
            <p class="muted">暂无地址，<a routerLink="/addresses">去新建地址</a></p>
          }

          <h2>选择支付方式</h2>
          <div class="pay-methods">
            @for (method of methods; track method.value) {
              <label class="pay-method" [class.active]="form.value.payment_method === method.value">
                <input type="radio" formControlName="payment_method" [value]="method.value">
                <img [src]="method.icon" [alt]="method.label">
                <span>{{ method.label }}</span>
              </label>
            }
          </div>

          @if (selectedMethod(); as method) {
            <div class="payment-qr">
              <div class="payment-qr-card">
                <div class="payment-qr-brand">
                  <img [src]="method.icon" [alt]="method.label">
                  <strong>{{ method.label }}</strong>
                </div>
                <img class="payment-qr-image" [src]="qrImage" alt="付款二维码">
              </div>
              <span>请使用{{ method.label }}扫码完成付款</span>
            </div>
          }
          <button class="solid wide" [disabled]="form.invalid || !view.addresses.length">我已完成付款</button>
        </form>
      </section>
    }
  `
})
export class PaymentComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
  qrImage = 'assets/payments/qr-code.png';
  methods: PayMethod[] = [
    { value: '微信', label: '微信支付', icon: 'assets/payments/wechat-pay.png' },
    { value: '支付宝', label: '支付宝', icon: 'assets/payments/alipay.png' },
    { value: '银联', label: '银联', icon: 'assets/payments/unionpay.png' },
    { value: 'Visa', label: 'Visa', icon: 'assets/payments/visa.png' },
    { value: 'Master', label: 'Master', icon: 'assets/payments/mastercard.png' }
  ];
  selectedInitialized = signal(false);
  form = this.fb.nonNullable.group({
    address_id: [0, Validators.required],
    payment_method: ['', Validators.required]
  });

  view$ = combineLatest([
    this.route.paramMap.pipe(switchMap(params => this.api.order(Number(params.get('id'))))),
    this.api.addresses()
  ]).pipe(map(([order, addresses]) => {
    if (!this.selectedInitialized() && addresses.length) {
      const selected = addresses.find(item => item.is_default) || addresses[0];
      this.form.patchValue({ address_id: selected.id });
      this.selectedInitialized.set(true);
    }
    return { order, addresses };
  }));

  selectedMethod() {
    return this.methods.find(method => method.value === this.form.value.payment_method);
  }

  finishPay(orderId: number) {
    if (this.form.invalid) return;
    this.api.payOrder(orderId, this.form.value.address_id!, this.form.value.payment_method!).subscribe(() => {
      this.toast.show('付款完成，订单已进入待收货');
      this.router.navigate(['/orders'], { queryParams: { filter: '待收货' } });
    });
  }
}
