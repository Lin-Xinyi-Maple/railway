import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { Product } from '../../models/domain';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (product(); as item) {
      <section class="chat-page">
        <aside class="chat-product panel">
          <img [src]="item.main_image || fallbackImage" [alt]="item.name">
          <span class="badge" [class.self]="item.shop_type === 'self'">{{ item.shop_type === 'self' ? '平台自营商家' : '普通商家' }}</span>
          <h1>{{ item.name }}</h1>
          <p class="muted">{{ item.shop_name }} · {{ item.origin }}</p>
          <a class="ghost" [routerLink]="['/products', item.id]">返回商品详情</a>
        </aside>

        <section class="chat-console panel">
          <header>
            <img src="assets/logo.png" alt="DeepSeek">
            <div>
              <span>DEEPSEEK AI 智能客服</span>
              <h2>关于 {{ item.name }} 的咨询</h2>
            </div>
          </header>

          <div class="chat-messages">
            @for (message of messages(); track $index) {
              <article class="chat-bubble" [class.user]="message.role === 'user'">
                <p>{{ message.content }}</p>
              </article>
            }
            @if (loading()) {
              <article class="chat-bubble">
                <p>正在整理回复...</p>
              </article>
            }
          </div>

          <form class="chat-input" [formGroup]="chatForm" (ngSubmit)="ask(item.id)">
            <input formControlName="question" placeholder="询问产地、保质期、发货、储存或食用建议">
            <button class="solid" [disabled]="chatForm.invalid || loading()">发送</button>
          </form>
        </section>
      </section>
    }
  `
})
export class AiChatComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  fallbackImage = 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80';
  product = signal<Product | null>(null);
  loading = signal(false);
  messages = signal<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是鲜域农品 AI 智能客服。你可以问我商品产地、储存方式、发货说明或食用建议。' }
  ]);
  chatForm = this.fb.nonNullable.group({ question: ['', Validators.required] });

  constructor() {
    this.route.paramMap.pipe(switchMap(params => this.api.product(Number(params.get('id'))))).subscribe(item => this.product.set(item));
  }

  ask(id: number) {
    if (this.chatForm.invalid || this.loading()) return;
    const question = this.chatForm.value.question!;
    this.messages.update(items => [...items, { role: 'user', content: question }]);
    this.chatForm.reset();
    this.loading.set(true);
    this.api.aiChat(id, question).subscribe({
      next: res => {
        this.messages.update(items => [...items, { role: 'assistant', content: res.answer }]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
