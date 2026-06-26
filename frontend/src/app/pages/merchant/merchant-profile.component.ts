import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Shop } from '../../models/domain';

@Component({
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    @if (auth.user(); as user) {
      <section class="profile-hero panel">
        <div class="profile-hero-main">
          @if (user.avatar) {
            <img class="profile-avatar image" [src]="user.avatar" [alt]="user.nickname">
          } @else {
            <div class="profile-avatar">{{ (user.nickname || user.username).slice(0, 1) }}</div>
          }
          <div>
            <span class="profile-kicker">个人中心</span>
            <h1>{{ user.nickname }}</h1>
            <p>{{ user.username }} · {{ user.email }}</p>
          </div>
        </div>
        <span class="profile-role-pill">{{ user.role }}</span>
      </section>

      <section class="profile-info panel">
        <div><span>用户名</span><strong>{{ user.username }}</strong></div>
        <div><span>昵称</span><strong>{{ user.nickname }}</strong></div>
        <div><span>邮箱</span><strong>{{ user.email }}</strong></div>
        <div><span>角色</span><strong>{{ user.role }}</strong></div>
        <div><span>账号状态</span><strong>{{ user.status }}</strong></div>
        <div><span>注册时间</span><strong>{{ user.created_at | date:'yyyy-MM-dd HH:mm:ss' }}</strong></div>
        <div class="profile-info-wide"><span>最后登录</span><strong>{{ user.last_login_at | date:'yyyy-MM-dd HH:mm:ss' }}</strong></div>
      </section>

      <section class="profile-actions merchant-profile-actions">
        <a class="panel profile-action" routerLink="/merchant/shop-layout"><svg viewBox="0 0 24 24"><path d="M4 4h16l2 6v2a4 4 0 0 1-6.6 3.03A4.7 4.7 0 0 1 12 16.5a4.7 4.7 0 0 1-3.4-1.47A4 4 0 0 1 2 12v-2l2-6Zm2 12h12v5H6v-5Zm.35-10-1.28 4H19l-1.35-4H6.35Z"/></svg>{{ shop() ? '布局店铺' : createShopLabel() }}</a>
        @if (shop()) {
          <a class="panel profile-action" routerLink="/merchant/products"><svg viewBox="0 0 24 24"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2Zm0 2.4 5.7 3.05L12 10.5 6.3 7.45 12 4.4ZM5 9.25l6 3.2v6.75l-6-3.2V9.25Zm14 6.75-6 3.2v-6.75l6-3.2V16Z"/></svg>修改商品</a>
          <a class="panel profile-action" routerLink="/merchant/products/new"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>发布商品</a>
          <a class="panel profile-action" routerLink="/merchant/after-sales"><svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-7 7H2l4 4 4-4H7a5 5 0 1 1 1.46 3.54L7.05 15A7 7 0 1 0 12 3Zm-1 4h2v5h4v2h-6V7Z"/></svg>售后</a>
        }
        <a class="panel profile-action" routerLink="/merchant/settings"><svg viewBox="0 0 24 24"><path d="M12 8.25A3.75 3.75 0 1 1 12 15.75 3.75 3.75 0 0 1 12 8.25Zm8.3 4.8c.04-.34.06-.7.06-1.05s-.02-.71-.06-1.05l2.03-1.58-2.1-3.64-2.39.96a8.1 8.1 0 0 0-1.82-1.05L15.67 3h-7.34l-.35 2.64c-.65.27-1.26.62-1.82 1.05l-2.39-.96-2.1 3.64 2.03 1.58c-.04.34-.06.7-.06 1.05s.02.71.06 1.05l-2.03 1.58 2.1 3.64 2.39-.96c.56.43 1.17.78 1.82 1.05L8.33 21h7.34l.35-2.64c.65-.27 1.26-.62 1.82-1.05l2.39.96 2.1-3.64-2.03-1.58Z"/></svg>设置</a>
      </section>
    }
  `
})
export class MerchantProfileComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  shop = signal<Shop | null>(null);

  constructor() {
    this.api.merchantShop().subscribe({
      next: shop => this.shop.set(shop),
      error: error => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.shop.set(null);
          return;
        }
        this.toast.show(error.error?.message || '店铺信息读取失败');
      }
    });
  }

  createShopLabel() {
    return this.auth.role() === 'admin' ? '新增自营店铺' : '新增普通店铺';
  }
}
