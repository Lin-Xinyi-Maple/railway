import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, switchMap, timer } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Message } from '../../models/domain';

interface MessageThread {
  key: string;
  name: string;
  avatar?: string;
  latest: Message;
  unread: number;
}

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="page-head dashboard-head">
      <div>
        <h1>消息</h1>
      </div>
      @if (auth.role() === 'admin') {
        <button class="solid icon-action" type="button" aria-label="发送系统消息" (click)="composeOpen.set(true)">+</button>
      }
    </section>

    @if (composeOpen()) {
      <section class="panel admin-message-composer">
        <header>
          <h2>发送系统消息</h2>
          <button class="ghost" type="button" (click)="composeOpen.set(false)">关闭</button>
        </header>
        <div class="inline-filters">
          <select [(ngModel)]="targetMode">
            <option value="all_users">全部普通用户</option>
            <option value="all_merchants">全部商家</option>
            <option value="selected">指定账号</option>
          </select>
        </div>
        @if (targetMode === 'selected') {
          <label>接收人邮箱
            <input [(ngModel)]="receiverEmails" placeholder="输入一个或多个邮箱，用逗号或空格分隔">
          </label>
        }
        <label>消息内容
          <textarea rows="5" [(ngModel)]="messageContent" placeholder="输入要发送的系统消息"></textarea>
        </label>
        <button class="solid" type="button" [disabled]="!canSendAdminMessage()" (click)="sendAdminMessage()">发送</button>
      </section>
    }

    @if (!composeOpen()) {
      @if (threads$ | async; as threads) {
        <section class="panel chat-list">
          @for (thread of threads; track thread.key) {
            <a class="chat-list-row" [routerLink]="['/messages', thread.key]" [queryParams]="{ name: thread.name }">
              <div class="chat-avatar">
                @if (thread.avatar) {
                  <img [src]="thread.avatar" [alt]="thread.name">
                } @else {
                  <span>{{ avatarLetter(thread.name) }}</span>
                }
                @if (thread.unread > 0) { <i>{{ thread.unread > 99 ? '99+' : thread.unread }}</i> }
              </div>
              <div class="chat-copy">
                <strong>{{ thread.name }}</strong>
                <p>{{ thread.latest.content || (thread.latest.image_url ? '[图片]' : '') }}</p>
              </div>
              <time>{{ thread.latest.created_at | date:'MM-dd HH:mm' }}</time>
              <span class="chevron">›</span>
            </a>
          } @empty {
            <div class="empty">暂无消息</div>
          }
        </section>
      }
    }
  `
})
export class MessagesComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  threads$ = timer(0, 2000).pipe(switchMap(() => this.api.messages()), map(messages => this.buildThreads(messages)));
  composeOpen = signal(false);
  targetMode: 'all_users' | 'all_merchants' | 'selected' = 'all_users';
  messageContent = '';
  receiverEmails = '';

  buildThreads(messages: Message[]): MessageThread[] {
    const me = this.auth.user()?.id;
    const grouped = new Map<string, MessageThread>();
    for (const message of messages) {
      const systemThread = !message.sender_id && message.type === 'system';
      const systemChat = message.type === 'system_chat';
      const key = systemThread || systemChat ? 'system' : `sender-${message.sender_id === me ? message.receiver_id : message.sender_id}`;
      const other = message.sender_id === me ? message.receiver : message.sender;
      const name = key === 'system' ? 'system' : (other?.nickname || other?.username || '联系人');
      const avatar = key === 'system' ? 'assets/logo-freshfield.svg' : (other?.avatar || '');
      const unread = message.receiver_id === me && !message.is_read ? 1 : 0;
      const existing = grouped.get(key);
      if (existing) {
        existing.unread += unread;
        if (Date.parse(message.created_at) > Date.parse(existing.latest.created_at)) existing.latest = message;
      } else {
        grouped.set(key, { key, name, avatar, latest: message, unread });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => Date.parse(b.latest.created_at) - Date.parse(a.latest.created_at));
  }

  avatarLetter(name: string) {
    return (name || '联').slice(0, 1);
  }

  canSendAdminMessage() {
    return !!this.messageContent.trim() && (this.targetMode !== 'selected' || this.emailList().length > 0);
  }

  sendAdminMessage() {
    if (!this.canSendAdminMessage()) return;
    this.api.adminSendMessage({
      target_mode: this.targetMode,
      receiver_emails: this.emailList(),
      content: this.messageContent.trim()
    }).subscribe(result => {
      this.toast.show(`系统消息已发送给 ${result.sent} 个账号`);
      this.messageContent = '';
      this.receiverEmails = '';
      this.composeOpen.set(false);
    });
  }

  private emailList() {
    return this.receiverEmails
      .split(/[\s,，;；]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }
}
