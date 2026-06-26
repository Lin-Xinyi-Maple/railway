import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, map, merge, startWith, switchMap, timer } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Message } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, RouterLink],
  template: `
    @if (thread$ | async; as thread) {
      <section class="chat-page system-chat-page">
        <aside class="chat-product panel">
          <span class="badge self">{{ thread.name }}</span>
          <h1>{{ thread.name }}</h1>
          <p class="muted">{{ thread.messages.length }} 条消息</p>
          <a class="ghost" routerLink="/messages">返回消息</a>
        </aside>

        <section class="chat-console panel">
          <header>
            <div>
              <span>鲜域农品消息中心</span>
              <h2>{{ thread.name }}</h2>
            </div>
          </header>

          <div class="chat-messages">
            @for (message of thread.messages; track message.id) {
              <article class="chat-bubble message-chat-bubble" [class.user]="isMine(message)">
                <p>{{ message.content }}</p>
                @if (message.image_url) {
                  <img class="message-inline-image" [src]="message.image_url" alt="消息图片">
                }
                @if (message.link_url) {
                  <a class="inline-link" [routerLink]="message.link_url">点击查看</a>
                }
                <time>{{ message.created_at | date:'MM-dd HH:mm' }}</time>
              </article>
            }
          </div>

          <form class="chat-input message-chat-input" [formGroup]="messageForm" (ngSubmit)="send(thread.receiverId)">
            <button class="ghost image-send-button" type="button" [disabled]="uploading()" (click)="fileInput.click()">+</button>
            <input #fileInput hidden type="file" accept="image/*" (change)="uploadImage($event)">
            <input formControlName="content" [placeholder]="isSystemThread() ? '给系统发送消息' : '输入聊天内容'">
            <button class="solid" [disabled]="messageForm.invalid && !imageUrl()">发送</button>
          </form>
          @if (imageUrl()) {
            <div class="message-image-preview">
              <img [src]="imageUrl()" alt="待发送图片">
              <button class="ghost" type="button" (click)="imageUrl.set('')">移除图片</button>
            </div>
          }
        </section>
      </section>
    }
  `
})
export class MessageThreadComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private reload$ = new Subject<void>();

  threadKey = signal(this.route.snapshot.paramMap.get('thread') || 'system');
  imageUrl = signal('');
  uploading = signal(false);
  messageForm = this.fb.nonNullable.group({ content: ['', Validators.required] });

  thread$ = merge(this.reload$, timer(0, 2000)).pipe(
    startWith(undefined),
    switchMap(() => {
      const key = this.route.snapshot.paramMap.get('thread') || 'system';
      this.threadKey.set(key);
      const payload = key === 'system' ? { thread_key: 'system' } : { sender_id: Number(key.replace('sender-', '')) };
      return this.api.markMessagesRead(payload).pipe(
        switchMap(() => this.api.messages()),
        map(messages => this.pickThread(messages, key))
      );
    })
  );

  pickThread(messages: Message[], key: string) {
    const me = this.currentUserId();
    const receiverId = key === 'system' ? me : Number(key.replace('sender-', ''));
    const threadMessages = messages
      .filter(message => {
        if (key === 'system') return (!message.sender_id && message.type === 'system') || message.type === 'system_chat';
        return message.sender_id === receiverId || message.receiver_id === receiverId;
      })
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const otherMessage = threadMessages.find(item => item.sender_id === receiverId || item.receiver_id === receiverId);
    const other = otherMessage?.sender_id === me ? otherMessage.receiver : otherMessage?.sender;
    return {
      name: key === 'system' ? 'system' : (other?.nickname || this.route.snapshot.queryParamMap.get('name') || '联系人'),
      receiverId,
      messages: threadMessages
    };
  }

  currentUserId() {
    return this.auth.user()?.id || 0;
  }

  isSystemThread() {
    return this.threadKey() === 'system';
  }

  isMine(message: Message) {
    return !!message.sender_id && message.sender_id === this.currentUserId();
  }

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadMessageImage(file).subscribe({
      next: result => {
        this.imageUrl.set(result.url);
        this.toast.show('图片已上传');
      },
      complete: () => this.uploading.set(false),
      error: () => this.uploading.set(false)
    });
    input.value = '';
  }

  send(receiverId: number) {
    const content = this.messageForm.value.content?.trim() || '';
    const image_url = this.imageUrl();
    if (!content && !image_url) return;
    const request$ = this.isSystemThread()
      ? this.api.sendSystemMessage({ content, image_url: image_url || undefined })
      : this.api.sendMessage({ receiver_id: receiverId, content, image_url: image_url || undefined });
    request$.subscribe(() => {
      this.messageForm.reset();
      this.imageUrl.set('');
      this.reload$.next();
    });
  }

}
