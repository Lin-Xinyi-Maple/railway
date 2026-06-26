import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, Subject, catchError, map, of, switchMap, takeUntil, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { Order } from '../../models/domain';

declare global {
  interface Window {
    BMap?: any;
    __freshfieldBaiduMapLoading?: Promise<void>;
    __freshfieldBaiduMapCallback?: () => void;
  }
}

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, RouterLink],
  template: `
    @if (view$ | async; as view) {
    @if (view.errorMessage) {
      <section class="panel order-detail-state">
        <h1>订单详情加载失败</h1>
        <p>{{ view.errorMessage }}</p>
        <a class="solid" routerLink="/orders">返回订单列表</a>
      </section>
    } @else if (!view.order) {
      <section class="panel order-detail-state">
        <h1>订单详情加载中</h1>
      </section>
    } @else {
      @let item = view.order;
      <section class="order-detail-page">
        <div class="order-detail-hero">
          <div class="order-hero-main">
            <img class="order-detail-product-image" [src]="productImage(item)" [alt]="dash(productName(item))">
            <div>
              <h1>{{ dash(productName(item)) }}</h1>
              <p>{{ item.order_no }} · {{ item.status }}</p>
            </div>
          </div>
          <span class="status-pill">{{ item.status || '-' }}</span>
        </div>

        <section class="panel order-detail-grid">
          <div class="order-detail-item">
            <span>订单号</span>
            <strong>{{ dash(item.order_no) }}</strong>
          </div>
          <div class="order-detail-item">
            <span>商家信息</span>
            <strong>{{ dash(shopName(item)) }}</strong>
            <small>{{ dash(shopPhone(item)) }}</small>
          </div>
          <div class="order-detail-item">
            <span>商品信息</span>
            <strong>{{ dash(productName(item)) }}</strong>
            <small>{{ dash(productUnit(item)) }}</small>
          </div>
          <div class="order-detail-item">
            <span>购买个数</span>
            <strong>{{ item.quantity || '-' }}</strong>
          </div>
          <div class="order-detail-item">
            <span>单价</span>
            <strong>{{ item.unit_price | currency:'CNY':'symbol-narrow' }}</strong>
          </div>
          <div class="order-detail-item">
            <span>总金额</span>
            <strong>{{ item.total_amount | currency:'CNY':'symbol-narrow' }}</strong>
          </div>
          <div class="order-detail-item wide">
            <span>收货地址</span>
            <strong>{{ dash(item.receiver_full_address) }}</strong>
          </div>
          <div class="order-detail-item wide">
            <span>发货地址</span>
            <strong>{{ dash(shippingAddress(item)) }}</strong>
          </div>
          <div class="order-detail-item">
            <span>订单创建时间</span>
            <strong>{{ item.created_at ? (item.created_at | date:'yyyy-MM-dd HH:mm') : '-' }}</strong>
          </div>
          <div class="order-detail-item">
            <span>支付时间</span>
            <strong>{{ item.paid_at ? (item.paid_at | date:'yyyy-MM-dd HH:mm') : '-' }}</strong>
          </div>
          <div class="order-detail-item">
            <span>付款方式</span>
            <div class="payment-method-visual">
              @if (paymentImage(item.payment_method)) {
                <img [src]="paymentImage(item.payment_method)" [alt]="dash(item.payment_method)">
              }
              <strong>{{ dash(item.payment_method) }}</strong>
            </div>
          </div>
          <div class="order-detail-item">
            <span>订单状态</span>
            <strong>{{ dash(item.status) }}</strong>
          </div>
        </section>

        @if (showMap(item)) {
        <section class="panel order-map-panel">
          <header class="order-map-head">
            <div class="map-brand">
              <img src="assets/about/baidu-map.png" alt="百度地图">
              <span>百度地图</span>
            </div>
            <h2>{{ item.shipping_notice || ('商品从' + dash(shippingAddress(item)) + '发货') }}</h2>
          </header>
          <div class="baidu-map-shell">
            <div #map class="baidu-map"></div>
            @if (mapMessage) {
              <div class="map-placeholder">{{ mapMessage }}</div>
            }
          </div>
        </section>
        }
      </section>
    }
    }
  `
})
export class OrderDetailComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map') mapRef?: ElementRef<HTMLDivElement>;

  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();
  private viewState$ = new BehaviorSubject<{ order?: Order; errorMessage: string }>({ errorMessage: '' });
  order?: Order;
  mapMessage = '地图加载中';
  private viewReady = false;
  view$ = this.viewState$.asObservable();

  ngAfterViewInit() {
    this.viewReady = true;
    this.renderMapSoon();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  constructor() {
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      tap(() => {
        this.order = undefined;
        this.mapMessage = '地图加载中';
        this.viewState$.next({ errorMessage: '' });
      }),
      switchMap(id => this.api.order(id).pipe(
        timeout(9000),
        catchError(() => of(null))
      )),
      takeUntil(this.destroy$)
    ).subscribe(order => {
      if (!order) {
        this.order = undefined;
        this.viewState$.next({ errorMessage: '订单接口没有返回数据，请确认订单存在、当前账号有权限查看，或后端服务没有卡住。' });
        return;
      }
      this.order = order;
      this.viewState$.next({ order, errorMessage: '' });
      if (this.showMap(order)) {
        this.mapMessage = '正在读取发货位置';
        this.renderMapSoon();
        this.loadShippingGeo(order.id);
      }
    });
  }

  dash(value?: string | number | null) {
    return value === undefined || value === null || value === '' ? '-' : String(value);
  }

  productName(item: Order) {
    return item.product ? item.product.name : '';
  }

  productUnit(item: Order) {
    return item.product ? item.product.unit : '';
  }

  productImage(item: Order) {
    return item.product?.main_image || 'assets/poster-apple.png';
  }

  shopName(item: Order) {
    return item.shop ? item.shop.name : '';
  }

  shopPhone(item: Order) {
    return item.shop ? item.shop.phone : '';
  }

  shippingAddress(item: Order) {
    return item.shop ? item.shop.shipping_address : '';
  }

  paymentImage(method?: string | null) {
    if (!method) return '';
    if (method.includes('微信')) return 'assets/payments/wechat-pay.png';
    if (method.includes('支付宝')) return 'assets/payments/alipay.png';
    if (method.includes('银联')) return 'assets/payments/unionpay.png';
    if (method.toLowerCase().includes('visa')) return 'assets/payments/visa.png';
    if (method.toLowerCase().includes('master')) return 'assets/payments/mastercard.png';
    return '';
  }

  showMap(item: Order) {
    return item.status === '待收货';
  }

  private renderMapSoon() {
    if (!this.viewReady || !this.order || !this.showMap(this.order)) return;
    setTimeout(() => this.renderMap(), 0);
  }

  private loadShippingGeo(orderId: number) {
    this.api.orderShippingGeo(orderId).pipe(timeout(9000)).subscribe({
      next: geo => {
        if (!this.order || this.order.id !== orderId) return;
        this.order = { ...this.order, ...geo };
        this.viewState$.next({ order: this.order, errorMessage: '' });
        this.renderMapSoon();
      },
      error: () => {
        this.mapMessage = '发货行政区读取失败，订单信息不受影响';
        this.renderMapSoon();
      }
    });
  }

  private async renderMap() {
    const mapEl = this.mapRef?.nativeElement;
    const currentOrder = this.order;
    const geo = currentOrder?.shipping_geo;
    const ak = environment.baiduMapAk || currentOrder?.baidu_map_ak || '';
    if (!mapEl) return;
    if (!ak) {
      this.mapMessage = '未配置百度地图 AK';
      return;
    }

    try {
      this.mapMessage = '正在加载百度地图';
      await this.loadBaiduMap(ak);
      const BMap = window.BMap;
      if (!BMap) throw new Error('Baidu Map SDK unavailable');
      const fallbackPoint = geo?.fallback_lng && geo?.fallback_lat
        ? new BMap.Point(geo.fallback_lng, geo.fallback_lat)
        : new BMap.Point(102.833669, 24.88149);
      const point = geo?.lng && geo?.lat ? new BMap.Point(geo.lng, geo.lat) : fallbackPoint;
      const zoom = geo?.fallback_zoom || 12;
      this.paintMap(BMap, mapEl, point, zoom);
      this.mapMessage = '';
      const lookupAddress = geo?.full_address || geo?.address || (currentOrder ? this.shippingAddress(currentOrder) : '');
      this.geocodeWithBaidu(BMap, lookupAddress, geo?.city).then(refinedPoint => {
        if (!refinedPoint || this.order !== currentOrder) return;
        this.paintMap(BMap, mapEl, refinedPoint, 14);
      });
    } catch {
      this.mapMessage = '百度地图加载失败';
    }
  }

  private paintMap(BMap: any, mapEl: HTMLDivElement, point: any, zoom = 12) {
    mapEl.innerHTML = '';
    const map = new BMap.Map(mapEl);
    map.centerAndZoom(point, zoom);
    map.addOverlay(new BMap.Marker(point));
    map.enableScrollWheelZoom(true);
    window.setTimeout(() => map.checkResize?.(), 120);
  }

  private geocodeWithBaidu(BMap: any, address: string, city?: string) {
    if (!address) return Promise.resolve(null);
    return new Promise<any>(resolve => {
      const timer = window.setTimeout(() => resolve(null), 5000);
      const geocoder = new BMap.Geocoder();
      geocoder.getPoint(address, (point: any) => {
        window.clearTimeout(timer);
        resolve(point || null);
      }, city || undefined);
    });
  }

  private loadBaiduMap(ak: string) {
    if (window.BMap) return Promise.resolve();
    if (window.__freshfieldBaiduMapLoading) return window.__freshfieldBaiduMapLoading;
    window.__freshfieldBaiduMapLoading = new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer = 0;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        ok ? resolve() : reject();
      };
      timer = window.setTimeout(() => finish(false), 8000);
      window.__freshfieldBaiduMapCallback = () => finish(true);
      const script = document.createElement('script');
      script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}&callback=__freshfieldBaiduMapCallback`;
      script.onerror = () => finish(false);
      document.body.appendChild(script);
    }).catch(error => {
      window.__freshfieldBaiduMapLoading = undefined;
      throw error;
    });
    return window.__freshfieldBaiduMapLoading;
  }
}
