import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-screen">
      <form class="panel auth-panel login-panel" [formGroup]="form" (ngSubmit)="submit()" autocomplete="on">
        <h2>找回密码</h2>
        <label>邮箱<input name="reset_email" type="email" autocomplete="email" formControlName="email" placeholder="请输入注册邮箱"></label>
        <div class="code-row">
          <label>邮箱验证码<input name="reset_email_code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="email_code" placeholder="请输入验证码"></label>
          <button type="button" class="ghost" [disabled]="codeCooldown() > 0" (click)="sendCode()">{{ codeCooldown() > 0 ? codeCooldown() + '秒' : '发送' }}</button>
        </div>
        <label>新密码<input name="reset_new_password" type="password" autocomplete="new-password" formControlName="password" placeholder="至少 6 位"></label>
        <button class="solid wide" [disabled]="form.invalid">重置密码</button>
        <div class="login-links">
          <a routerLink="/login">返回登录</a>
          <a routerLink="/register">没有账号？立即注册</a>
        </div>
      </form>
    </section>
  `
})
export class ForgotComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private codeTimer?: number;
  codeCooldown = signal(0);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    email_code: ['', Validators.required],
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
    if (this.form.invalid) return;
    this.auth.resetPassword(this.form.getRawValue()).subscribe(() => {
      this.toast.show('密码已重置，请重新登录');
      this.router.navigateByUrl('/login');
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

