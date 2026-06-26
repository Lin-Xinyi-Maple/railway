import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, startWith, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink],
  template: `
    @if (view$ | async; as view) {
      <section class="page-head comments-page-head">
        <div>
          <h1>商品评价</h1>
          <p><a [routerLink]="['/products', productId()]">{{ view.product.name }}</a> · {{ view.product.shop_name }}</p>
        </div>
      </section>

      <section class="comments-layout">
        <aside class="panel comment-compose">
          <div class="section-title">
            <span>评</span>
            <div>
              <h2>发布评价</h2>
            </div>
          </div>
          <label>评分（满分 10 分）
            <input type="number" min="1" max="10" [(ngModel)]="rating" [disabled]="!view.can_comment">
          </label>
          <label>评价内容
            <textarea rows="6" [(ngModel)]="content" [disabled]="!view.can_comment" placeholder="写下口感、包装、物流或服务体验"></textarea>
          </label>
          <div class="comment-upload-row">
            <button class="ghost plus-upload" type="button" [disabled]="!view.can_comment || uploading()" (click)="fileInput.click()">+</button>
            <input #fileInput hidden type="file" accept="image/*" (change)="uploadImage($event)">
            @if (imageUrl()) {
              <img [src]="imageUrl()" alt="评价图片预览">
            } @else {
              <span>可上传 1 张评价图片</span>
            }
          </div>
          <button class="solid wide" type="button" [disabled]="!view.can_comment || !content.trim()" (click)="publish()">发布评价</button>
        </aside>

        <main class="comment-feed">
          @for (comment of view.comments; track comment.id) {
            <article class="panel comment-card">
              <div class="comment-head">
                @if (comment.user?.avatar) {
                  <img [src]="comment.user?.avatar" [alt]="comment.user?.nickname">
                } @else {
                  <span>{{ (comment.user?.nickname || '用').slice(0, 1) }}</span>
                }
                <div>
                  <strong>{{ comment.user?.nickname || '用户' }}</strong>
                  <small>{{ comment.created_at | date:'yyyy-MM-dd HH:mm:ss' }} · {{ comment.rating }}/10 分</small>
                </div>
              </div>
              <p>{{ comment.content }}</p>
              @if (comment.image_url) {
                <img class="comment-image" [src]="comment.image_url" alt="评价图片">
              }
              @if (canDeleteComment(comment)) {
                <button class="ghost danger-text tiny-action" type="button" (click)="deleteComment(comment.id)">删除评论</button>
              }
              @if (comment.merchant_reply) {
                <div class="merchant-reply">
                  <strong>商家回复</strong>
                  <p>{{ comment.merchant_reply }}</p>
                  <small>{{ comment.merchant_replied_at | date:'yyyy-MM-dd HH:mm:ss' }}</small>
                  @if (canDeleteReply(view.can_reply)) {
                    <button class="ghost danger-text tiny-action" type="button" (click)="deleteReply(comment.id)">删除回复</button>
                  }
                </div>
              } @else if (view.can_reply) {
                <div class="reply-box">
                  <input #replyInput placeholder="回复这条评价">
                  <button class="ghost" type="button" (click)="reply(comment.id, replyInput.value); replyInput.value = ''">回复</button>
                </div>
              }
            </article>
          } @empty {
            <section class="empty panel">暂无评价</section>
          }
        </main>
      </section>
    }
  `
})
export class ProductCommentsComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  productId = signal(Number(this.route.snapshot.paramMap.get('id')));
  reload$ = new Subject<void>();
  rating = 10;
  content = '';
  imageUrl = signal('');
  uploading = signal(false);

  view$ = this.reload$.pipe(
    startWith(undefined),
    switchMap(() => this.api.productComments(this.productId()))
  );

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadCommentImage(file).subscribe({
      next: result => {
        this.imageUrl.set(result.url);
        this.toast.show('评价图片已上传');
      },
      complete: () => this.uploading.set(false),
      error: () => this.uploading.set(false)
    });
    input.value = '';
  }

  publish() {
    this.api.createComment({
      product_id: this.productId(),
      rating: Math.max(1, Math.min(10, Number(this.rating) || 10)),
      content: this.content.trim(),
      image_url: this.imageUrl() || undefined
    }).subscribe(() => {
      this.toast.show('评价已发布');
      this.content = '';
      this.rating = 10;
      this.imageUrl.set('');
      this.reload$.next();
    });
  }

  reply(commentId: number, reply: string) {
    const text = reply.trim();
    if (!text) return;
    this.api.replyComment(commentId, text).subscribe(() => {
      this.toast.show('回复已发布');
      this.reload$.next();
    });
  }

  canDeleteComment(comment: { user_id: number }) {
    const user = this.auth.user();
    return user?.role === 'admin' || (user?.role === 'user' && user.id === comment.user_id);
  }

  canDeleteReply(canReply: boolean) {
    const role = this.auth.role();
    return role === 'admin' || (role === 'merchant' && canReply);
  }

  deleteComment(commentId: number) {
    this.api.deleteComment(commentId).subscribe(() => {
      this.toast.show('已删除');
      this.reload$.next();
    });
  }

  deleteReply(commentId: number) {
    this.api.deleteCommentReply(commentId).subscribe(() => {
      this.toast.show('回复已删除');
      this.reload$.next();
    });
  }
}
