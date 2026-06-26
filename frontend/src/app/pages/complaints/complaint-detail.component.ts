import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  template: `
    @if (complaint$ | async; as item) {
      <section class="page-head detail-head complaint-detail-head">
        <div>
          <a class="back-link" routerLink="/complaints">返回投诉与反馈</a>
          <h1>{{ item.title }}</h1>
          <p>{{ item.created_at | date:'yyyy-MM-dd HH:mm' }}</p>
        </div>
        <div class="detail-actions">
          @if (auth.role() !== 'admin' || item.is_processed) {
            <span class="status-pill" [class.done]="item.is_processed">{{ item.is_processed ? '已处理' : '待处理' }}</span>
          }
          @if (auth.role() === 'admin' && !item.is_processed) {
            <button class="solid" type="button" (click)="markProcessed(item.id)">已处理</button>
          }
        </div>
      </section>

      <section class="panel complaint-detail-card">
        <aside class="complaint-meta">
          <div>
            <span>提交人</span>
            <strong>{{ item.complainant?.nickname || '-' }}</strong>
          </div>
          <div>
            <span>联系电话</span>
            <strong>{{ item.phone || '-' }}</strong>
          </div>
          <div>
            <span>处理状态</span>
            <strong>{{ item.is_processed ? '已处理' : '待处理' }}</strong>
          </div>
          <div>
            <span>提交时间</span>
            <strong>{{ item.created_at | date:'yyyy-MM-dd HH:mm' }}</strong>
          </div>
        </aside>

        <main class="complaint-content">
          <article>
            <span>反馈内容</span>
            <p>{{ item.content }}</p>
          </article>
          <div class="complaint-gallery refined">
            @for (image of images(item); track image) {
              <a [href]="image" target="_blank" rel="noreferrer">
                <img [src]="image" alt="投诉图片">
              </a>
            } @empty {
              <div class="empty">没有上传图片</div>
            }
          </div>
        </main>
      </section>
    }
  `
})
export class ComplaintDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  private reload$ = new BehaviorSubject(0);
  private id = Number(this.route.snapshot.paramMap.get('id'));
  complaint$ = this.reload$.pipe(switchMap(() => this.api.complaint(this.id)));

  images(item: { image1?: string; image2?: string; image3?: string }) {
    return [item.image1, item.image2, item.image3].filter(Boolean) as string[];
  }

  markProcessed(id: number) {
    this.api.processComplaint(id).subscribe(() => {
      this.toast.show('投诉与反馈已标记为已处理');
      this.reload$.next(Date.now());
    });
  }
}
