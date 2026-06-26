import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, ProductCardComponent],
  template: `
    @if (view$ | async; as view) {
      <section class="profile-hero panel">
        <div class="profile-hero-main">
          @if (view.user.avatar) {
            <img class="profile-avatar image" [src]="view.user.avatar" [alt]="view.user.nickname">
          } @else {
            <div class="profile-avatar">{{ (view.user.nickname || view.user.username).slice(0, 1) }}</div>
          }
          <div>
            <span class="profile-kicker">个人中心</span>
            <h1>{{ view.user.nickname }}</h1>
            <p>{{ view.user.username }} · {{ view.user.email }}</p>
          </div>
        </div>
        <span class="profile-role-pill">{{ view.user.role }}</span>
      </section>

      <section class="profile-info panel">
        <div><span>用户名</span><strong>{{ view.user.username }}</strong></div>
        <div><span>昵称</span><strong>{{ view.user.nickname }}</strong></div>
        <div><span>邮箱</span><strong>{{ view.user.email }}</strong></div>
        <div><span>角色</span><strong>{{ view.user.role }}</strong></div>
        <div><span>账号状态</span><strong>{{ view.user.status }}</strong></div>
        <div><span>注册时间</span><strong>{{ view.user.created_at | date:'yyyy-MM-dd HH:mm:ss' }}</strong></div>
        <div class="profile-info-wide"><span>最后登录</span><strong>{{ view.user.last_login_at | date:'yyyy-MM-dd HH:mm:ss' }}</strong></div>
      </section>

      <section class="profile-actions">
        <a class="panel profile-action" routerLink="/orders" [queryParams]="{ filter: 'all' }"><svg viewBox="0 0 24 24"><path d="M4 7l8-4 8 4v10l-8 4-8-4V7Zm8 2.2L17 6.7 12 4.2 7 6.7l5 2.5Z"/></svg>全部订单</a>
        <a class="panel profile-action" routerLink="/orders" [queryParams]="{ filter: '待付款' }"><svg viewBox="0 0 24 24"><path d="M3 6h18v12H3V6Zm2 3v2h14V9H5Zm0 5v2h6v-2H5Z"/></svg>待付款</a>
        <a class="panel profile-action" routerLink="/orders" [queryParams]="{ filter: 'paid' }"><svg viewBox="0 0 24 24"><path d="M9.5 17.5 4.5 12l1.7-1.6 3.3 3.5 8.3-8.5 1.7 1.7-10 10.4Z"/></svg>已付款</a>
        <a class="panel profile-action" routerLink="/orders" [queryParams]="{ filter: '待收货' }"><svg viewBox="0 0 24 24"><path d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 5.8 2.9L12 10 6.2 7.1 12 4.2ZM5 8.8l6 3v7.4l-6-3V8.8Zm14 7.4-6 3v-7.4l6-3v7.4Z"/></svg>待收货</a>
        <a class="panel profile-action" routerLink="/orders" [queryParams]="{ filter: 'aftersale' }"><svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-7 7H2l4 4 4-4H7a5 5 0 1 1 1.46 3.54L7.05 15A7 7 0 1 0 12 3Zm-1 4h2v5h4v2h-6V7Z"/></svg>售后</a>
        <a class="panel profile-action" routerLink="/favorites"><svg viewBox="0 0 24 24"><path d="M12 20.4 10.55 19.1C5.4 14.45 2 11.4 2 7.65 2 4.6 4.4 2.2 7.45 2.2c1.72 0 3.37.8 4.55 2.05A6.05 6.05 0 0 1 16.55 2.2C19.6 2.2 22 4.6 22 7.65c0 3.75-3.4 6.8-8.55 11.45L12 20.4Z"/></svg>我的收藏</a>
        <a class="panel profile-action" routerLink="/addresses"><svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>我的地址</a>
        <a class="panel profile-action" routerLink="/settings"><svg viewBox="0 0 24 24"><path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2h-4l-.4 3.1A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5A9 9 0 0 0 4.5 12c0 .5 0 1 .1 1.5l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5L10 22h4l.4-3.1a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5ZM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>设置</a>
        <a class="panel profile-action" routerLink="/reviews"><svg viewBox="0 0 24 24"><path d="M12 3l2.5 5.1 5.6.8-4.05 3.95.95 5.55L12 15.78 7 18.4l.95-5.55L3.9 8.9l5.6-.8L12 3Z"/></svg>评价</a>
      </section>

      <section class="page-head">
        <h1>猜你喜欢</h1>
      </section>
      <section class="product-grid">
        @for (product of view.products; track product.id) {
          <app-product-card [product]="product" />
        }
      </section>
    }
  `
})
export class ProfileComponent {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  view$ = combineLatest([
    this.auth.me().pipe(map(res => res.data)),
    this.api.products({ page: 1, page_size: 4, sort: 'paid_users' })
  ]).pipe(map(([user, products]) => ({ user, products: products.items })));
}
