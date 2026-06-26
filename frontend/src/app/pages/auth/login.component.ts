import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-screen">
      <form class="panel auth-panel login-panel" [formGroup]="form" (ngSubmit)="submit()">
        <h2>账号登录</h2>
        <label>用户名<input formControlName="username" placeholder="请输入用户名"></label>
        <label>密码<input formControlName="password" type="password" placeholder="请输入密码"></label>
        <button class="solid wide" [disabled]="form.invalid">登录</button>
        <div class="login-links">
          <a routerLink="/forgot">忘记密码</a>
          <a routerLink="/register">没有账号？立即注册</a>
        </div>
      </form>
    </section>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;
    this.auth.login(this.form.value.username!, this.form.value.password!).subscribe(() => {
      this.toast.show('登录成功');
      this.auth.redirectHome();
    });
  }
}
