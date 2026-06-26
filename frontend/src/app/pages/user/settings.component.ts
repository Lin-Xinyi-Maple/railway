import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Account } from '../../models/domain';
import { ImageCropperComponent } from '../../shared/image-cropper.component';

type CodeTarget = 'oldEmail' | 'newEmail' | 'deactivate';

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, ImageCropperComponent],
  template: `
    <section class="settings-shell">
      <aside class="panel settings-card">
        @if (currentUser(); as user) {
          <div class="settings-avatar-wrap">
            @if (avatarPreview()) {
              <img class="settings-avatar" [src]="avatarPreview()" [alt]="user.nickname">
            } @else {
              <div class="settings-avatar letter">{{ (user.nickname || user.username).slice(0, 1) }}</div>
            }
            <label class="avatar-upload">
              <input type="file" accept="image/*" (change)="onAvatarSelected($event)">
              {{ avatarUploading() ? '上传中...' : '更换头像' }}
            </label>
          </div>
          <h1>{{ user.nickname }}</h1>
          <p>{{ user.username }} · {{ roleLabel(user.role) }}</p>
          <div class="settings-status">
            <span>账号状态</span><strong>{{ statusLabel(user.status) }}</strong>
            <span>注册时间</span><strong>{{ user.created_at | date:'yyyy-MM-dd HH:mm' }}</strong>
            <span>最后登录</span><strong>{{ user.last_login_at | date:'yyyy-MM-dd HH:mm' }}</strong>
          </div>
          <a class="ghost wide" [routerLink]="backLink()">返回个人中心</a>
        }
      </aside>

      <main class="settings-main">
        <section class="panel setting-section">
          <div class="section-title">
            <span>01</span>
            <div>
              <h2>个人资料</h2>
            </div>
          </div>
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
            <label>昵称<input formControlName="nickname" autocomplete="nickname" placeholder="请输入昵称"></label>
            <button class="solid" [disabled]="profileForm.invalid || avatarUploading()">保存昵称</button>
          </form>
        </section>

        <section class="panel setting-section">
          <div class="section-title">
            <span>02</span>
            <div>
              <h2>邮箱换绑</h2>
            </div>
          </div>
          <form [formGroup]="emailForm" (ngSubmit)="saveEmail()">
            <label>当前邮箱<input [value]="currentUser()?.email || ''" readonly></label>
            <div class="inline-code">
              <label>原邮箱验证码<input name="old_email_code_setting" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="old_email_code" placeholder="请输入验证码"></label>
              <button type="button" class="ghost code-button" [disabled]="oldEmailCooldown() > 0" (click)="sendCode('oldEmail')">{{ oldEmailCooldown() > 0 ? oldEmailCooldown() + '秒' : '发送验证码' }}</button>
            </div>
            <label>新邮箱<input name="new_email_setting" type="email" autocomplete="off" formControlName="new_email" placeholder="请输入新邮箱"></label>
            <div class="inline-code">
              <label>新邮箱验证码<input name="new_email_code_setting" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="new_email_code" placeholder="请输入验证码"></label>
              <button type="button" class="ghost code-button" [disabled]="newEmailCooldown() > 0 || emailForm.controls.new_email.invalid" (click)="sendCode('newEmail')">{{ newEmailCooldown() > 0 ? newEmailCooldown() + '秒' : '发送验证码' }}</button>
            </div>
            <button class="solid" [disabled]="emailForm.invalid">确认换绑邮箱</button>
          </form>
        </section>

        <section class="panel setting-section">
          <div class="section-title">
            <span>03</span>
            <div>
              <h2>修改密码</h2>
            </div>
          </div>
          <form [formGroup]="passwordForm" (ngSubmit)="savePassword()">
            <label>当前密码<input type="password" autocomplete="current-password" formControlName="current_password" placeholder="请输入当前密码"></label>
            <label>新密码<input type="password" autocomplete="new-password" formControlName="new_password" placeholder="至少 6 位"></label>
            <label>确认新密码<input type="password" autocomplete="new-password" formControlName="confirm_password" placeholder="再次输入新密码"></label>
            <button class="solid" [disabled]="passwordForm.invalid">修改密码</button>
          </form>
        </section>

        <section class="panel setting-section danger-section">
          <div class="section-title">
            <span>04</span>
            <div>
              <h2>删除账号</h2>
            </div>
          </div>
          <form [formGroup]="deactivateForm" (ngSubmit)="deactivate()">
            <div class="inline-code">
              <label>邮箱验证码<input name="deactivate_email_code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="email_code" placeholder="请输入验证码"></label>
              <button type="button" class="ghost code-button" [disabled]="deactivateCooldown() > 0" (click)="sendCode('deactivate')">{{ deactivateCooldown() > 0 ? deactivateCooldown() + '秒' : '发送验证码' }}</button>
            </div>
            <label class="confirm-line"><input type="checkbox" formControlName="confirmed"> 我确认要删除当前账号</label>
            <button class="danger-button" [disabled]="deactivateForm.invalid">删除账号</button>
          </form>
        </section>
      </main>
    </section>

    @if (cropSource()) {
      <app-image-cropper title="裁剪头像" [imageSrc]="cropSource()" (cancel)="cropSource.set('')" (cropped)="saveAvatarCrop($event)" />
    }
  `
})
export class SettingsComponent implements OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private timers: number[] = [];

  currentUser = signal<Account | null>(this.auth.user());
  avatarPreview = signal(this.auth.user()?.avatar || '');
  avatarUploading = signal(false);
  cropSource = signal('');
  oldEmailCooldown = signal(0);
  newEmailCooldown = signal(0);
  deactivateCooldown = signal(0);

  profileForm = this.fb.nonNullable.group({
    nickname: [this.auth.user()?.nickname || '', Validators.required],
    avatar: [this.auth.user()?.avatar || '']
  });

  emailForm = this.fb.nonNullable.group({
    old_email_code: ['', Validators.required],
    new_email: ['', [Validators.required, Validators.email]],
    new_email_code: ['', Validators.required]
  });

  passwordForm = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(6)]],
    confirm_password: ['', Validators.required]
  });

  deactivateForm = this.fb.nonNullable.group({
    email_code: ['', Validators.required],
    confirmed: [false, Validators.requiredTrue]
  });

  constructor() {
    this.auth.me().subscribe(res => {
      this.currentUser.set(res.data);
      this.avatarPreview.set(res.data.avatar || '');
      this.profileForm.patchValue({ nickname: res.data.nickname, avatar: res.data.avatar || '' });
      this.auth.updateUser(res.data);
    });
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.cropSource.set(String(reader.result || ''));
    reader.readAsDataURL(file);
    input.value = '';
  }

  saveAvatarCrop(blob: Blob) {
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    this.avatarUploading.set(true);
    this.api.uploadAvatar(file).subscribe({
      next: result => {
        const nickname = this.profileForm.value.nickname || this.currentUser()?.nickname || '';
        this.avatarPreview.set(result.url);
        this.api.updateProfile({ nickname, avatar: result.url }).subscribe(user => {
          this.currentUser.set(user);
          this.avatarPreview.set(user.avatar || '');
          this.profileForm.patchValue({ nickname: user.nickname, avatar: user.avatar || '' });
          this.auth.updateUser(user);
          this.cropSource.set('');
          this.toast.show('头像已上传并保存');
        });
      },
      complete: () => this.avatarUploading.set(false),
      error: () => this.avatarUploading.set(false)
    });
  }

  saveProfile() {
    if (this.profileForm.invalid) return;
    this.api.updateProfile(this.profileForm.getRawValue()).subscribe(user => {
      this.currentUser.set(user);
      this.avatarPreview.set(user.avatar || '');
      this.auth.updateUser(user);
      this.toast.show('昵称已更新');
    });
  }

  saveEmail() {
    if (this.emailForm.invalid) return;
    this.api.updateEmail(this.emailForm.getRawValue()).subscribe(user => {
      this.currentUser.set(user);
      this.auth.updateUser(user);
      this.emailForm.reset();
      this.toast.show('邮箱已换绑');
    });
  }

  savePassword() {
    if (this.passwordForm.invalid) return;
    const raw = this.passwordForm.getRawValue();
    if (raw.new_password !== raw.confirm_password) {
      this.toast.show('两次输入的新密码不一致');
      return;
    }
    this.api.updatePassword({ current_password: raw.current_password, new_password: raw.new_password }).subscribe(() => {
      this.passwordForm.reset();
      this.toast.show('密码已修改');
    });
  }

  deactivate() {
    if (this.deactivateForm.invalid) return;
    this.api.deleteOwnAccount(this.deactivateForm.getRawValue().email_code).subscribe(() => {
      this.toast.show('账号已删除');
      this.auth.logout();
    });
  }

  sendCode(target: CodeTarget) {
    const user = this.currentUser();
    const email = target === 'newEmail' ? this.emailForm.value.new_email : user?.email;
    if (!email) {
      this.toast.show('请先填写邮箱');
      return;
    }
    this.auth.sendCode(email).subscribe(() => {
      this.toast.show('验证码已发送');
      this.startCooldown(target);
    });
  }

  roleLabel(role: string) {
    return role === 'admin' ? '自营账号' : role === 'merchant' ? '商家账号' : '普通用户';
  }

  statusLabel(status: string) {
    return status === 'active' ? '正常' : '已禁用';
  }

  backLink() {
    const role = this.currentUser()?.role;
    return role === 'merchant' || role === 'admin' ? '/merchant/profile' : '/profile';
  }

  ngOnDestroy() {
    this.timers.forEach(timer => window.clearInterval(timer));
  }

  private startCooldown(target: CodeTarget) {
    const cooldown = target === 'oldEmail' ? this.oldEmailCooldown : target === 'newEmail' ? this.newEmailCooldown : this.deactivateCooldown;
    cooldown.set(60);
    const timer = window.setInterval(() => {
      cooldown.update(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    this.timers.push(timer);
  }
}
