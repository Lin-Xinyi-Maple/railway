import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouteConfigLoadEnd, RouteConfigLoadStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { LoadingService } from './core/loading.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="shell">
      <header class="topbar">
        <a routerLink="/home" class="brand">
          <img class="brand-logo" src="assets/logo-freshfield.svg" alt="鲜域农品 logo">
          <span>
            <strong>鲜域农品</strong>
            <small>鲜域农品电商系统2026</small>
          </span>
        </a>

        <nav [class.user-nav]="isVisitorOrUser()">
          <a class="nav-link" routerLink="/home">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z"/></svg>
            <span>首页</span>
          </a>
          <a class="nav-link" routerLink="/shop">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Zm8 .2 4.2-2.35L12 4 7.8 6.35 12 8.7Zm-6 1.18v4.45l5 2.82v-4.5L6 9.88Zm12 0-5 2.77v4.5l5-2.82V9.88Z"/></svg>
            <span>推荐</span>
          </a>

          @if (auth.isLoggedIn()) {
            <a class="nav-link badge-nav" routerLink="/messages">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm1 4v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>
              <span>消息</span>
              @if (unreadCount() > 0) { <i class="nav-badge">{{ unreadCount() > 99 ? '99+' : unreadCount() }}</i> }
            </a>
          } @else {
            <a class="nav-link badge-nav" routerLink="/messages">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm1 4v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>
              <span>消息</span>
            </a>
          }

          @if (isVisitorOrUser()) {
            <a class="nav-link" routerLink="/friends/add">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM7 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 2c-3.3 0-6 1.7-6 3.8V21h12v-3.2c0-2.1-2.7-3.8-6-3.8ZM7 14c-2.8 0-5 1.4-5 3.2V20h5v-2.2c0-1.2.7-2.3 1.9-3.1A8 8 0 0 0 7 14Z"/></svg>
              <span>社区</span>
            </a>
            <a class="nav-link" routerLink="/cart">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a2 2 0 1 0 .01 0H7Zm10 0a2 2 0 1 0 .01 0H17ZM5.2 6l1.25 7.2A3 3 0 0 0 9.4 16h6.9a3 3 0 0 0 2.9-2.24L21 7H7.1L6.75 5H3v1h2.2Z"/></svg>
              <span>购物车</span>
            </a>
            <a class="nav-link" routerLink="/profile">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0H5Z"/></svg>
              <span>我的</span>
            </a>
            <a class="nav-link" routerLink="/data">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H4v-2Zm1-8h4v6H5v-6Zm5-6h4v12h-4V5Zm5 3h4v9h-4V8Z"/></svg>
              <span>数据</span>
            </a>
          }

          @if (auth.role() === 'merchant' || auth.role() === 'admin') {
            <a class="nav-link" routerLink="/merchant/profile">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0H5Z"/></svg>
              <span>我的</span>
            </a>
            <a class="nav-link" routerLink="/merchant">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9 5 4h14l2 5v2a4 4 0 0 1-2 3.45V21H5v-6.55A4 4 0 0 1 3 11V9Zm7 12v-6h4v6h5v-6.1a4.1 4.1 0 0 1-3-1.25 4.15 4.15 0 0 1-6 0 4.15 4.15 0 0 1-5 1.1V21h5Z"/></svg>
              <span>商家数据</span>
            </a>
          }

          @if (auth.role() === 'admin') {
            <a class="nav-link" routerLink="/admin">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 5 5 2v2c0 3.5-2 6.8-5 8.2C9 17.8 7 14.5 7 11V9l5-2Z"/></svg>
              <span>自营管理</span>
            </a>
          }

          @if (isVisitorOrUser() || auth.role() === 'merchant' || auth.role() === 'admin') {
            <a class="nav-link" routerLink="/complaints">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v11H8l-4 4V4Zm4 5v2h8V9H8Zm0 4v2h5v-2H8Z"/></svg>
              <span>投诉与反馈</span>
            </a>
          }

          <a class="nav-link" routerLink="/about">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 17h2v-6h-2v6Zm1-9a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 12 8Zm0 14a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"/></svg>
            <span>关于网站</span>
          </a>
        </nav>

        <div class="account">
          @if (auth.isLoggedIn()) {
            <span>欢迎您，{{ auth.user()?.nickname }}</span>
            <button class="ghost" (click)="auth.logout()">退出</button>
          } @else {
            <a class="ghost" routerLink="/login">登录</a>
            <a class="solid" routerLink="/register">注册</a>
          }
        </div>
      </header>
      <main>
        <router-outlet />
      </main>
      @if (loading.visible()) {
        <div class="page-loading" role="status" aria-live="polite" aria-label="页面加载中">
          <div class="google-spinner" aria-hidden="true"></div>
        </div>
      }
      @if (toast.message()) { <div class="toast">{{ toast.message() }}</div> }
    </div>
  `
})
export class AppComponent implements OnDestroy {
  auth = inject(AuthService);
  toast = inject(ToastService);
  loading = inject(LoadingService);
  private router = inject(Router);
  private api = inject(ApiService);
  unreadCount = signal(0);
  private timer = window.setInterval(() => this.refreshUnread(), 2000);
  private routeLoadingSub: Subscription;

  constructor() {
    this.refreshUnread();
    window.addEventListener('focus', this.refreshUnread);
    this.routeLoadingSub = this.router.events.subscribe(event => {
      if (event instanceof RouteConfigLoadStart) {
        if (event.route.path !== 'home') this.loading.show();
      }
      if (event instanceof RouteConfigLoadEnd) {
        if (event.route.path !== 'home') this.loading.hide();
      }
    });
  }

  ngOnDestroy() {
    window.clearInterval(this.timer);
    window.removeEventListener('focus', this.refreshUnread);
    this.routeLoadingSub.unsubscribe();
  }

  refreshUnread = () => {
    if (!this.auth.isLoggedIn()) {
      this.unreadCount.set(0);
      return;
    }
    this.api.messageUnreadCount().subscribe({
      next: res => this.unreadCount.set(res.count),
      error: () => this.unreadCount.set(0)
    });
  };

  isVisitorOrUser() {
    return !this.auth.isLoggedIn() || this.auth.role() === 'user';
  }
}
