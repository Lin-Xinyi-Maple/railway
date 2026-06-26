import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="page-head detail-head">
      <div>
        <a class="back-link" routerLink="/admin">返回自营管理</a>
        <h1>系统日志管理</h1>
      </div>
      <button class="ghost danger-text" type="button" (click)="clearLogs()">清空日志</button>
    </section>

    <section class="panel data-detail-page log-console">
      <div class="list-toolbar log-toolbar">
        <select [(ngModel)]="actorRole" (ngModelChange)="reload()">
          <option value="">全部操作者</option>
          <option value="admin">管理员</option>
          <option value="merchant">商家</option>
          <option value="user">普通用户</option>
          <option value="system">系统</option>
        </select>
        <select [(ngModel)]="action" (ngModelChange)="reload()">
          <option value="">全部动作</option>
          @for (option of actionOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
        <select [(ngModel)]="targetType" (ngModelChange)="reload()">
          <option value="">全部对象</option>
          @for (option of targetOptions; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
      </div>

      @if (logs$ | async; as page) {
        <div class="log-list">
          @for (log of page.items; track log.id) {
            <article class="admin-list-row rich-row log-row">
              <span class="log-action">{{ log.action.slice(0, 2).toUpperCase() }}</span>
              <div>
                <strong>{{ log.action }} · {{ log.target_type }} #{{ log.target_id || '-' }}</strong>
                <small>
                  {{ log.actor_username || '系统' }} / {{ log.actor_role || '-' }}
                  · {{ log.ip_address || '-' }}
                  · {{ log.created_at | date:'yyyy-MM-dd HH:mm:ss' }}
                </small>
                @if (log.detail) { <p>{{ log.detail }}</p> }
              </div>
              <button class="ghost danger-text" type="button" (click)="deleteLog(log.id)">删除</button>
            </article>
          } @empty {
            <div class="empty">暂无系统日志</div>
          }
        </div>
      }
    </section>
  `
})
export class AdminSystemLogsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private reload$ = new BehaviorSubject(0);
  actorRole = '';
  action = '';
  targetType = '';
  actionOptions = [
    { value: 'delete_own_account', label: '删除账号' },
    { value: 'delete_shop', label: '删除店铺' },
    { value: 'delete_own_shop', label: '商家删除店铺' },
    { value: 'update_address', label: '修改地址' },
    { value: 'delete_address', label: '删除地址' },
    { value: 'update_complaint', label: '修改投诉' },
    { value: 'delete_complaint', label: '撤销投诉' },
    { value: 'process_complaint', label: '处理投诉' },
    { value: 'delete_friend', label: '删除好友' },
    { value: 'delete_system_log', label: '删除日志' },
    { value: 'clear_system_logs', label: '清空日志' },
  ];
  targetOptions = [
    { value: 'account', label: '账号' },
    { value: 'shop', label: '店铺' },
    { value: 'address', label: '地址' },
    { value: 'complaint', label: '投诉与反馈' },
    { value: 'friend', label: '好友' },
    { value: 'system_log', label: '系统日志' },
  ];

  logs$ = this.reload$.pipe(
    switchMap(() => this.api.systemLogs({
      actor_role: this.actorRole,
      action: this.action.trim(),
      target_type: this.targetType.trim(),
      page: 1,
      page_size: 80
    }))
  );

  reload() {
    this.reload$.next(Date.now());
  }

  deleteLog(id: number) {
    if (!window.confirm('确认删除这条系统日志？')) return;
    this.api.deleteSystemLog(id).subscribe(() => {
      this.toast.show('系统日志已删除');
      this.reload();
    });
  }

  clearLogs() {
    if (!window.confirm('确认清空所有系统日志？')) return;
    this.api.clearSystemLogs().subscribe(() => {
      this.toast.show('系统日志已清空');
      this.reload();
    });
  }
}
