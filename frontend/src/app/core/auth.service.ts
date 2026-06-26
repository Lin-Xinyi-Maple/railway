import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Account, ApiResponse, Role } from '../models/domain';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private base = environment.apiUrl;
  private userSignal = signal<Account | null>(this.readUser());

  user = this.userSignal.asReadonly();
  isLoggedIn = computed(() => !!this.userSignal());
  role = computed<Role | null>(() => this.userSignal()?.role || null);

  login(username: string, password: string) {
    return this.http.post<ApiResponse<{ token: string; access_token?: string; refresh_token?: string; user: Account }>>(`${this.base}/auth/login`, { username, password }).pipe(
      tap(res => this.saveSession(res.data.token, res.data.user, res.data.refresh_token))
    );
  }

  register(payload: Record<string, unknown>) {
    return this.http.post<ApiResponse<{ token: string; access_token?: string; refresh_token?: string; user: Account }>>(`${this.base}/auth/register`, payload).pipe(
      tap(res => this.saveSession(res.data.token, res.data.user, res.data.refresh_token))
    );
  }

  sendCode(email: string) {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/auth/send-code`, { email });
  }

  me() {
    return this.http.get<ApiResponse<Account>>(`${this.base}/auth/me`);
  }

  resetPassword(payload: { email: string; email_code: string; password: string }) {
    return this.http.post<ApiResponse<boolean>>(`${this.base}/auth/reset-password`, payload);
  }

  token() {
    return localStorage.getItem('token');
  }

  refreshToken() {
    return localStorage.getItem('refresh_token');
  }

  refreshSession() {
    const refreshToken = this.refreshToken();
    if (!refreshToken) return throwError(() => new Error('缺少刷新令牌'));
    return this.http.post<ApiResponse<{ token: string; refresh_token?: string; user: Account }>>(`${this.base}/auth/refresh`, { refresh_token: refreshToken }).pipe(
      tap(res => this.saveSession(res.data.token, res.data.user, res.data.refresh_token || refreshToken))
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.userSignal.set(null);
    this.router.navigateByUrl('/login');
  }

  updateUser(user: Account) {
    localStorage.setItem('user', JSON.stringify(user));
    this.userSignal.set(user);
  }

  redirectHome() {
    this.router.navigateByUrl('/home');
  }

  private saveSession(token: string, user: Account, refreshToken?: string) {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    this.userSignal.set(user);
  }

  private readUser() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Account;
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      return null;
    }
  }
}
