import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { UserStats } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe],
  template: `
    @if (view$ | async; as view) {
      <section class="page-head data-head">
        <div>
          <h1>我的数据</h1>
        </div>
        <button class="solid" type="button" (click)="exportExcel(view.raw)">导出 Excel</button>
      </section>

      <section class="kpi-grid">
        <div class="kpi"><span>最近创建订单</span><strong>{{ view.raw.created_orders }}</strong></div>
        <div class="kpi"><span>成交订单</span><strong>{{ view.raw.paid_orders }}</strong></div>
        <div class="kpi"><span>成交金额总量</span><strong>{{ view.raw.paid_amount | currency:'CNY':'symbol-narrow' }}</strong></div>
        <div class="kpi warning"><span>成交分类数</span><strong>{{ view.raw.category_paid.length }}</strong></div>
      </section>

      <section class="data-layout expanded-data-layout">
        <article class="panel data-panel">
          <h2>各类农产品付款比例</h2>
          <div class="donut-chart" [style.background]="view.donutBackground">
            <span>{{ view.raw.paid_amount | currency:'CNY':'symbol-narrow' }}</span>
          </div>
          <div class="chart-legend">
            @for (item of view.items; track item.name) {
              <div>
                <i [style.background]="item.color"></i>
                <span>{{ item.name }}</span>
                <strong>{{ item.percent }}%</strong>
              </div>
            } @empty {
              <p class="muted">暂无成交订单数据</p>
            }
          </div>
        </article>

        <article class="panel data-panel trend-panel">
          <div class="chart-title-row">
            <h2>最近 7 天订单趋势</h2>
            <div class="chart-key">
              <span><i class="created"></i>创建</span>
              <span><i class="paid"></i>付款</span>
            </div>
          </div>
          <svg class="line-chart" viewBox="0 0 640 240" role="img" aria-label="最近七天订单趋势折线图">
            <path class="chart-grid-line" d="M40 50H600M40 100H600M40 150H600M40 200H600" />
            <polyline class="line-created" [attr.points]="view.createdLine" />
            <polyline class="line-paid" [attr.points]="view.paidLine" />
            @for (point of view.createdPoints; track point.label) {
              <circle class="dot-created" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
            }
            @for (point of view.paidPoints; track point.label) {
              <circle class="dot-paid" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
            }
          </svg>
          <div class="trend-axis">
            @for (day of view.daily; track day.date) {
              <span>{{ day.label }}</span>
            }
          </div>
        </article>

        <article class="panel data-panel">
          <h2>每日付款金额</h2>
          <div class="daily-bars">
            @for (day of view.daily; track day.date) {
              <div class="daily-bar">
                <strong>{{ day.amount | currency:'CNY':'symbol-narrow' }}</strong>
                <span [style.height.%]="day.height"></span>
                <small>{{ day.label }}</small>
              </div>
            }
          </div>
        </article>

        <article class="panel data-panel">
          <h2>付款金额排行</h2>
          <div class="bar-list">
            @for (item of view.items; track item.name) {
              <div class="bar-row">
                <span>{{ item.name }}</span>
                <div><i [style.width.%]="item.percent" [style.background]="item.color"></i></div>
                <strong>{{ item.amount | currency:'CNY':'symbol-narrow' }}</strong>
              </div>
            } @empty {
              <div class="empty">暂无统计数据</div>
            }
          </div>
        </article>
      </section>
    }
  `
})
export class DataComponent {
  private api = inject(ApiService);
  colors = ['#276044', '#b45535', '#9aa64f', '#1e7b83', '#7b5f3a', '#6f7f95'];
  view$ = this.api.userStats().pipe(map(raw => this.buildView(raw)));

  buildView(raw: UserStats) {
    const total = raw.category_paid.reduce((sum, item) => sum + item.amount, 0);
    let start = 0;
    const items = raw.category_paid.map((item, index) => {
      const percent = total ? Math.round((item.amount / total) * 100) : 0;
      const end = start + percent;
      const color = this.colors[index % this.colors.length];
      const segment = `${color} ${start}% ${end}%`;
      start = end;
      return { ...item, percent, color, segment };
    });
    const donutBackground = items.length
      ? `conic-gradient(${items.map(item => item.segment).join(', ')})`
      : 'conic-gradient(#ded7c8 0% 100%)';

    const daily = (raw.daily?.length ? raw.daily : this.emptyDaily()).map(item => ({
      ...item,
      label: item.date.slice(5).replace('-', '/'),
      height: 0
    }));
    const maxOrders = Math.max(1, ...daily.map(item => Math.max(item.created, item.paid)));
    const maxAmount = Math.max(1, ...daily.map(item => item.amount));
    const chartPoints = (field: 'created' | 'paid') => daily.map((item, index) => {
      const x = daily.length === 1 ? 320 : 40 + index * (560 / (daily.length - 1));
      const y = 200 - (item[field] / maxOrders) * 150;
      return { x, y, label: `${item.date}-${field}` };
    });
    const createdPoints = chartPoints('created');
    const paidPoints = chartPoints('paid');
    const withBars = daily.map(item => ({
      ...item,
      height: item.amount ? Math.max(8, Math.round((item.amount / maxAmount) * 100)) : 4
    }));

    return {
      raw,
      items,
      donutBackground,
      daily: withBars,
      createdPoints,
      paidPoints,
      createdLine: createdPoints.map(point => `${point.x},${point.y}`).join(' '),
      paidLine: paidPoints.map(point => `${point.x},${point.y}`).join(' ')
    };
  }

  emptyDaily() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 6 + index);
      return { date: date.toISOString().slice(0, 10), created: 0, paid: 0, amount: 0 };
    });
  }

  exportExcel(stats: UserStats) {
    const rows: (string | number | null)[][] = [
      ['指标', '数值'],
      ['最近创建订单数量', stats.created_orders],
      ['成交订单数量', stats.paid_orders],
      ['成交订单金额总量', stats.paid_amount],
      [],
      ['分类', '付款金额']
    ];
    stats.category_paid.forEach(item => rows.push([item.name, item.amount]));
    rows.push([], ['日期', '创建订单', '付款订单', '付款金额']);
    (stats.daily || []).forEach(item => rows.push([item.date, item.created, item.paid, item.amount]));

    const html = `
      <html><head><meta charset="utf-8"></head><body>
      <table border="1">${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</table>
      </body></html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `鲜域农品数据统计-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
