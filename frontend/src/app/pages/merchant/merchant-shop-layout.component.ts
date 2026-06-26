import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Shop } from '../../models/domain';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-head detail-head">
      <div>
        <a class="back-link" routerLink="/merchant/profile">返回我的</a>
        <h1>{{ shop() ? '布局店铺' : '新增店铺' }}</h1>
      </div>
    </section>

    @if (!loading()) {
      <form class="panel merchant-form" (ngSubmit)="save()">
        <div class="shop-type-note">
          <span>{{ authRoleLabel() }}</span>
          <strong>{{ shopTypeLabel() }}</strong>
        </div>
        <label>店铺名称<input [(ngModel)]="draft.name" name="name" required></label>
        <label>描述<textarea rows="6" [(ngModel)]="draft.description" name="description"></textarea></label>
        <label>发货地址<input [(ngModel)]="draft.shipping_address" name="shipping_address" required></label>
        <label>手机号<input [(ngModel)]="draft.phone" name="phone" required></label>
        <div class="form-actions">
          <button class="solid" type="submit" [disabled]="!canSave()">{{ shop() ? '保存修改' : '创建店铺' }}</button>
          @if (shop()) {
            <button class="ghost danger-text" type="button" (click)="deleteShop()">删除店铺</button>
          }
        </div>
      </form>
    } @else {
      <section class="panel empty">正在读取店铺信息</section>
    }
  `
})
export class MerchantShopLayoutComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  shop = signal<Shop | null>(null);
  loading = signal(true);
  draft = {
    name: '',
    description: '',
    shipping_address: '',
    phone: ''
  };

  constructor() {
    this.loadShop();
  }

  canSave() {
    return !!this.draft.name.trim() && !!this.draft.shipping_address.trim() && !!this.draft.phone.trim();
  }

  save() {
    if (!this.canSave()) return;
    const payload = {
      name: this.draft.name.trim(),
      description: this.draft.description.trim(),
      shipping_address: this.draft.shipping_address.trim(),
      phone: this.draft.phone.trim()
    };
    const isCreate = !this.shop();
    const request$ = isCreate ? this.api.createMerchantShop(payload) : this.api.updateMerchantShop(payload);
    request$.subscribe(shop => {
      this.shop.set(shop);
      this.patchDraft(shop);
      this.toast.show(isCreate ? '店铺已创建' : '店铺信息已更新');
      this.router.navigateByUrl('/merchant/profile');
    });
  }

  deleteShop() {
    if (!window.confirm('确认删除店铺？店铺下的商品、订单、购物车、收藏和评论都会一起删除。')) return;
    this.api.deleteMerchantShop().subscribe(() => {
      this.toast.show('店铺及关联记录已删除');
      this.router.navigateByUrl('/merchant/profile');
    });
  }

  authRoleLabel() {
    return this.auth.role() === 'admin' ? '管理员账号' : '商家账号';
  }

  shopTypeLabel() {
    const type = this.shop()?.type || (this.auth.role() === 'admin' ? 'self' : 'merchant');
    return type === 'self' ? '平台自营店铺' : '普通店铺';
  }

  private loadShop() {
    this.api.merchantShop().subscribe({
      next: shop => {
        this.shop.set(shop);
        this.patchDraft(shop);
        this.loading.set(false);
      },
      error: error => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.shop.set(null);
          this.loading.set(false);
          return;
        }
        this.loading.set(false);
        this.toast.show(error.error?.message || '店铺信息读取失败');
      }
    });
  }

  private patchDraft(shop: Shop) {
    this.draft = {
      name: shop.name || '',
      description: shop.description || '',
      shipping_address: shop.shipping_address || '',
      phone: shop.phone || ''
    };
  }
}
