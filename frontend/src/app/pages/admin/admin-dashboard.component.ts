import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { Account, Order, Product, Shop } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  template: `
    <section class="page-head dashboard-head">
      <div>
        <h1>自营管理</h1>
      </div>
      <div class="head-actions">
        <a class="ghost" routerLink="/admin/logs">系统日志</a>
        <button class="solid" type="button" (click)="exportData()">导出 Excel</button>
      </div>
    </section>

    @if (summary$ | async; as summary) {
      <section class="kpi-grid merchant-data-grid">
        <a class="kpi data-kpi" routerLink="/admin/data/buyers">
          <span>买家账号</span><strong>{{ summary.users || 0 }}</strong>
        </a>
        <a class="kpi data-kpi" routerLink="/admin/data/shops">
          <span>店铺</span><strong>{{ summary.shops || 0 }}</strong>
        </a>
        <a class="kpi data-kpi" routerLink="/admin/data/products">
          <span>在售商品</span><strong>{{ summary.products || 0 }}</strong>
        </a>
        <a class="kpi data-kpi" routerLink="/admin/data/orders">
          <span>订单数量</span><strong>{{ summary.orders || 0 }}</strong>
        </a>
      </section>

      <section class="panel chart-panel refined-chart">
        <header>
          <div><span>平台成交趋势</span><h2>总销售额与成交订单量</h2></div>
        </header>
        <div class="chart-combo">
          <div class="chart-visual">
            <svg class="line-chart" viewBox="0 0 640 240" role="img" aria-label="平台销售趋势折线图">
              <path class="chart-grid-line" d="M40 50H600M40 100H600M40 150H600M40 200H600M40 50V200M600 50V200" />
              <text class="axis-label" x="18" y="204">0</text>
              <polyline class="line-created" [attr.points]="line(summary.sales_chart || [], 'sales')" />
              <polyline class="line-paid" [attr.points]="line(summary.sales_chart || [], 'orders')" />
              @for (point of dots(summary.sales_chart || [], 'sales'); track point.label) {
                <circle class="dot-created" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
              }
              @for (point of dots(summary.sales_chart || [], 'orders'); track point.label) {
                <circle class="dot-paid" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
              }
            </svg>
            <div class="trend-axis dynamic-axis" [style.--axis-count]="(summary.sales_chart || []).length || 1">
              @for (row of summary.sales_chart || []; track row.date) { <span>{{ label(row.date) }}</span> }
            </div>
          </div>
          <div class="bar-chart-panel">
            <span>条形统计</span>
            <div class="bar-pair-chart">
              @for (row of summary.sales_chart || []; track row.date) {
                <div class="bar-pair">
                  <div class="bar-pair-bars">
                    <i class="bar-sales" [style.height.%]="barHeight(summary.sales_chart || [], row.sales, 'sales')"></i>
                    <i class="bar-orders" [style.height.%]="barHeight(summary.sales_chart || [], row.orders, 'orders')"></i>
                  </div>
                  <small>{{ label(row.date) }}</small>
                </div>
              }
            </div>
          </div>
        </div>
        <div class="chart-key">
          <span><i class="created"></i>销售额</span>
          <span><i class="paid"></i>成交订单量</span>
        </div>
      </section>

      <section class="panel chart-panel refined-chart">
        <header>
          <div><span>平台累计增长</span><h2>普通用户与商家店铺</h2></div>
        </header>
        <div class="chart-combo">
          <div class="chart-visual">
            <svg class="line-chart" viewBox="0 0 640 240" role="img" aria-label="平台累计增长折线图">
              <path class="chart-grid-line" d="M40 50H600M40 100H600M40 150H600M40 200H600M40 50V200M600 50V200" />
              <text class="axis-label" x="18" y="204">0</text>
              <polyline class="line-created" [attr.points]="growthLine(summary.growth_chart || [], 'users')" />
              <polyline class="line-paid" [attr.points]="growthLine(summary.growth_chart || [], 'shops')" />
              @for (point of growthDots(summary.growth_chart || [], 'users'); track point.label) {
                <circle class="dot-created" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
              }
              @for (point of growthDots(summary.growth_chart || [], 'shops'); track point.label) {
                <circle class="dot-paid" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
              }
            </svg>
            <div class="trend-axis dynamic-axis" [style.--axis-count]="(summary.growth_chart || []).length || 1">
              @for (row of summary.growth_chart || []; track row.date) { <span>{{ label(row.date) }}</span> }
            </div>
          </div>
          <div class="bar-chart-panel">
            <span>条形统计</span>
            <div class="bar-pair-chart">
              @for (row of summary.growth_chart || []; track row.date) {
                <div class="bar-pair">
                  <div class="bar-pair-bars">
                    <i class="bar-sales" [style.height.%]="growthBarHeight(summary.growth_chart || [], row.users, 'users')"></i>
                    <i class="bar-orders" [style.height.%]="growthBarHeight(summary.growth_chart || [], row.shops, 'shops')"></i>
                  </div>
                  <small>{{ label(row.date) }}</small>
                </div>
              }
            </div>
          </div>
        </div>
        <div class="chart-key">
          <span><i class="created"></i>累计普通用户</span>
          <span><i class="paid"></i>累计店铺</span>
        </div>
      </section>
    }
  `
})
export class AdminDashboardComponent {
  private api = inject(ApiService);
  summary$ = this.api.adminSummary('week');

  line(rows: { date: string; sales: number; orders: number }[], key: 'sales' | 'orders') {
    return this.dots(rows, key).map(point => `${point.x},${point.y}`).join(' ');
  }

  dots(rows: { date: string; sales: number; orders: number }[], key: 'sales' | 'orders') {
    return this.numericDots(rows.map(row => ({ date: row.date, value: Number(row[key]) || 0 })), key);
  }

  growthLine(rows: { date: string; users: number; shops: number }[], key: 'users' | 'shops') {
    return this.growthDots(rows, key).map(point => `${point.x},${point.y}`).join(' ');
  }

  growthDots(rows: { date: string; users: number; shops: number }[], key: 'users' | 'shops') {
    return this.numericDots(rows.map(row => ({ date: row.date, value: Number(row[key]) || 0 })), key);
  }

  label(date: string) {
    return date.slice(5).replace('-', '/');
  }

  barHeight(rows: { sales: number; orders: number }[], value: number, key: 'sales' | 'orders') {
    const max = Math.max(...rows.map(row => Number(row[key]) || 0), 1);
    return value ? Math.max(8, Math.round((Number(value) / max) * 100)) : 4;
  }

  growthBarHeight(rows: { users: number; shops: number }[], value: number, key: 'users' | 'shops') {
    const max = Math.max(...rows.map(row => Number(row[key]) || 0), 1);
    return value ? Math.max(8, Math.round((Number(value) / max) * 100)) : 4;
  }

  exportData() {
    this.api.adminSummary('week').subscribe(summary => {
      const rows = [
        ['数据类型', 'ID', '名称/订单号', '用户名/店铺/商品', '邮箱/手机号', '角色/类型/分类', '状态', '单价', '单位', '库存', '预警库存', '产地', '种植方式', '保质期', '储存条件', '购买数量', '订单金额', '买家', '商家', '收货地址', '创建时间', '支付时间', '付款方式', '备注/图片'],
        ...(summary.buyers || []).map((a: Account) => ['买家账号', a.id, a.nickname, a.username, a.email, a.role, a.status, '', '', '', '', '', '', '', '', '', '', '', '', '', a.created_at || '', a.last_login_at || '', '', a.avatar || '']),
        ...(summary.merchant_shops || []).map((s: Shop) => ['店铺', s.id, s.name, s.owner?.nickname || '', s.phone, s.type, s.status, '', '', '', '', '', '', '', '', '', s.paid_amount ?? '', '', s.owner?.nickname || '', s.shipping_address, s.created_at || '', '', '', s.description || '']),
        ...(summary.product_list || []).map((p: Product) => ['商品', p.id, p.name, p.shop_name, '', p.category_name, p.status, p.price, p.unit, p.stock, p.warning_stock, p.origin, p.planting_method, p.shelf_life_days, p.storage_condition, '', '', '', p.shop_name, '', '', '', '', [p.main_image, p.image_2, p.image_3].filter(Boolean).join(' | ')]),
        ...(summary.order_list || []).map((o: Order) => ['订单', o.id, o.order_no, o.product?.name || '', o.shop?.phone || '', o.product?.category_name || '', o.status, o.unit_price, o.product?.unit || '', o.product?.stock ?? '', o.product?.warning_stock ?? '', o.product?.origin || '', o.product?.planting_method || '', o.product?.shelf_life_days ?? '', o.product?.storage_condition || '', o.quantity, o.total_amount, o.user?.nickname || '', o.shop?.name || '', o.receiver_full_address || '', o.created_at, o.paid_at || '', o.payment_method || '', '']),
      ];
      this.downloadCsv('admin-data.csv', rows);
    });
  }

  private numericDots(rows: { date: string; value: number }[], key: string) {
    if (!rows.length) return [];
    const max = Math.max(...rows.map(row => row.value), 1);
    return rows.map((row, index) => ({
      x: rows.length === 1 ? 320 : 40 + index * (560 / (rows.length - 1)),
      y: 200 - (row.value / max) * 150,
      label: `${row.date}-${key}`
    }));
  }

  private downloadCsv(filename: string, rows: unknown[][]) {
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
