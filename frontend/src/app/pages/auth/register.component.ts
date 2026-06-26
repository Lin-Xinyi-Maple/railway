import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-screen">
      <form class="panel auth-panel login-panel register-panel" [formGroup]="form" (ngSubmit)="submit()" autocomplete="on">
        <h2>注册账号</h2>
        <div class="segmented">
          <button type="button" [class.active]="form.value.role === 'user'" (click)="form.patchValue({ role: 'user' })">用户</button>
          <button type="button" [class.active]="form.value.role === 'merchant'" (click)="form.patchValue({ role: 'merchant' })">商家</button>
          <button type="button" [class.active]="form.value.role === 'admin'" (click)="form.patchValue({ role: 'admin' })">自营</button>
        </div>
        <label>用户名<input name="username" autocomplete="username" formControlName="username" placeholder="请输入用户名"></label>
        <label>昵称<input name="nickname" autocomplete="nickname" formControlName="nickname" placeholder="请输入昵称"></label>
        <label>邮箱<input name="email" type="email" autocomplete="email" formControlName="email" placeholder="请输入邮箱"></label>
        @if (form.value.role !== 'admin') {
          <div class="code-row">
            <label>邮箱验证码<input name="email_code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="email_code" placeholder="请输入验证码"></label>
            <button type="button" class="ghost" [disabled]="codeCooldown() > 0" (click)="sendCode()">{{ codeCooldown() > 0 ? codeCooldown() + '秒' : '发送' }}</button>
          </div>
        } @else {
          <label>自营授权码<input name="admin_invite_code" autocomplete="off" formControlName="admin_invite_code" placeholder="请输入授权码"></label>
        }
        <label>密码<input name="new-password" type="password" autocomplete="new-password" formControlName="password" placeholder="至少 6 位"></label>
        <button class="solid wide" [disabled]="form.invalid">注册并进入</button>
        <div class="login-links">
          <a routerLink="/login">已有账号？去登录</a>
        </div>
      </form>
    </section>
  `
})
export class RegisterComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private codeTimer?: number;
  codeCooldown = signal(0);

  form = this.fb.nonNullable.group({
    role: ['user', Validators.required],
    username: ['', Validators.required],
    nickname: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    email_code: [''],
    admin_invite_code: [''],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnDestroy() {
    if (this.codeTimer) window.clearInterval(this.codeTimer);
  }

  sendCode() {
    if (this.codeCooldown() > 0) return;
    if (this.form.controls.email.invalid) {
      this.toast.show('请先填写正确邮箱');
      return;
    }
    this.auth.sendCode(this.form.value.email!).subscribe(() => {
      this.toast.show('验证码已发送');
      this.startCooldown();
    });
  }

  submit() {
    this.auth.register(this.form.getRawValue()).subscribe(() => {
      this.toast.show('注册成功');
      this.auth.redirectHome();
    });
  }

  private startCooldown() {
    this.codeCooldown.set(60);
    if (this.codeTimer) window.clearInterval(this.codeTimer);
    this.codeTimer = window.setInterval(() => {
      this.codeCooldown.update(value => Math.max(value - 1, 0));
      if (this.codeCooldown() <= 0 && this.codeTimer) {
        window.clearInterval(this.codeTimer);
        this.codeTimer = undefined;
      }
    }, 1000);
  }
}
