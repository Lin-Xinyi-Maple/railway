import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Address } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule],
  template: `
    <section class="address-layout fixed-layout">
      <form class="panel address-form fixed-pane address-editor" [formGroup]="form" (ngSubmit)="submit()">
        <div class="section-title address-title">
          <span>址</span>
          <div>
            <h1>{{ editingId() ? '编辑地址' : '我的地址' }}</h1>
          </div>
        </div>

        <div class="address-form-grid">
          <label>收货人<input formControlName="receiver_name" placeholder="请输入姓名"></label>
          <label>手机号<input formControlName="phone" placeholder="请输入手机号"></label>
          <label>省<input formControlName="province" placeholder="例如：广东省"></label>
          <label>市<input formControlName="city" placeholder="例如：广州市"></label>
          <label>区<input formControlName="district" placeholder="例如：天河区"></label>
          <label class="full-line">详细地址<input formControlName="detail" placeholder="街道、门牌号等详细信息"></label>
        </div>

        <label class="check-line address-default"><input type="checkbox" formControlName="is_default"> 设为默认地址</label>
        <div class="form-actions">
          <button class="solid address-submit" [disabled]="form.invalid">{{ editingId() ? '保存修改' : '保存地址' }}</button>
          @if (editingId()) {
            <button class="ghost" type="button" (click)="cancelEdit()">取消编辑</button>
          }
        </div>
      </form>

      <section class="scroll-pane">
        <div class="page-head compact-head">
          <h1>地址簿</h1>
        </div>
        @if (addresses$ | async; as addresses) {
          <section class="address-list">
            @for (address of addresses; track address.id) {
              <article class="panel address-card">
                <strong>{{ address.receiver_name }} · {{ address.phone }}</strong>
                <p>{{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}</p>
                <div class="card-actions">
                  @if (address.is_default) { <span>默认地址</span> }
                  @else { <span class="address-placeholder" aria-hidden="true"></span> }
                  <button class="ghost tiny-action" type="button" (click)="edit(address)">编辑</button>
                  <button class="ghost danger-text tiny-action" type="button" (click)="deleteAddress(address.id)">删除</button>
                </div>
              </article>
            } @empty {
              <div class="empty panel">暂无地址</div>
            }
          </section>
        }
      </section>
    </section>
  `
})
export class AddressesComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private reload$ = new BehaviorSubject(0);
  editingId = signal<number | null>(null);

  addresses$ = this.reload$.pipe(switchMap(() => this.api.addresses()));
  form = this.fb.nonNullable.group({
    receiver_name: ['', Validators.required],
    phone: ['', Validators.required],
    province: ['', Validators.required],
    city: ['', Validators.required],
    district: ['', Validators.required],
    detail: ['', Validators.required],
    is_default: [false]
  });

  submit() {
    if (this.form.invalid) return;
    const payload = this.form.getRawValue();
    const request$ = this.editingId()
      ? this.api.updateAddress(this.editingId()!, payload)
      : this.api.createAddress(payload);
    request$.subscribe(() => {
      this.toast.show(this.editingId() ? '地址已更新' : '地址已保存');
      this.cancelEdit();
      this.reload();
    });
  }

  edit(address: Address) {
    this.editingId.set(address.id);
    this.form.patchValue({
      receiver_name: address.receiver_name,
      phone: address.phone,
      province: address.province,
      city: address.city,
      district: address.district,
      detail: address.detail,
      is_default: address.is_default
    });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.form.reset({ receiver_name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false });
  }

  deleteAddress(id: number) {
    if (!window.confirm('确认删除这个地址？历史订单会保留。')) return;
    this.api.deleteAddress(id).subscribe(() => {
      this.toast.show('地址已删除');
      if (this.editingId() === id) this.cancelEdit();
      this.reload();
    });
  }

  private reload() {
    this.reload$.next(Date.now());
  }
}
