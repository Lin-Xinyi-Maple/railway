import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Complaint } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="page-head complaints-page-head">
      <h1>投诉与反馈</h1>
    </section>

    @if (auth.role() === 'admin') {
      @if (complaints$ | async; as complaints) {
        <section class="panel complaint-list-panel">
          <div class="list-toolbar complaint-admin-search inline-filters">
            <input [(ngModel)]="adminKeyword" (ngModelChange)="reload()" placeholder="按照标题搜索">
            <select [(ngModel)]="processedFilter" (ngModelChange)="reload()">
              <option value="">全部状态</option>
              <option value="0">待处理</option>
              <option value="1">已处理</option>
            </select>
          </div>
          @for (item of complaints; track item.id) {
            <a class="complaint-row" [routerLink]="['/complaints', item.id]">
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.complainant?.nickname }} · {{ item.phone }}</span>
              </div>
              <span class="status-pill compact" [class.done]="item.is_processed">{{ statusLabel(item) }}</span>
              <time>{{ item.created_at | date:'yyyy-MM-dd HH:mm' }}</time>
            </a>
          } @empty { <div class="empty">暂无投诉与反馈</div> }
        </section>
      }
    } @else {
      <section class="complaint-shell fixed-layout">
        <form class="panel scroll-pane complaint-form" (ngSubmit)="submit()">
          <h2>{{ editingId() ? '编辑反馈' : '提交反馈' }}</h2>
          <label>标题<input [(ngModel)]="title" name="title"></label>
          <label>联系电话<input [(ngModel)]="phone" name="phone"></label>
          <label>正文<textarea rows="8" [(ngModel)]="content" name="content"></textarea></label>
          <div class="complaint-images">
            @for (image of images(); track image) {
              <button class="image-chip" type="button" (click)="removeImage(image)">
                <img [src]="image" alt="投诉图片">
              </button>
            }
            @if (images().length < 3) {
              <button class="ghost" type="button" [disabled]="uploading()" (click)="fileInput.click()">上传图片</button>
            }
            <input #fileInput hidden type="file" accept="image/*" (change)="uploadImage($event)">
          </div>
          <div class="form-actions">
            <button class="solid" type="submit" [disabled]="!title.trim() || !content.trim() || !phone.trim()">
              {{ editingId() ? '保存修改' : '提交' }}
            </button>
            @if (editingId()) {
              <button class="ghost" type="button" (click)="resetForm()">取消编辑</button>
            }
          </div>
        </form>

        @if (complaints$ | async; as complaints) {
          <main class="panel scroll-pane complaint-list-panel">
            <h2>我的投诉与反馈</h2>
            @for (item of complaints; track item.id) {
              <article class="complaint-row complaint-manage-row">
                <a [routerLink]="['/complaints', item.id]">
                  <div>
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.created_at | date:'yyyy-MM-dd HH:mm' }}</span>
                  </div>
                </a>
                <div class="row-actions complaint-actions-inline">
                  <span class="status-pill compact" [class.done]="item.is_processed">{{ statusLabel(item) }}</span>
                  @if (!item.is_processed) {
                    <button class="ghost tiny-action" type="button" (click)="edit(item)">编辑</button>
                    <button class="ghost danger-text tiny-action" type="button" (click)="deleteComplaint(item.id)">撤销</button>
                  }
                </div>
              </article>
            } @empty { <div class="empty">暂无提交记录</div> }
          </main>
        }
      </section>
    }
  `
})
export class ComplaintsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  reload$ = new BehaviorSubject(0);
  complaints$ = this.reload$.pipe(switchMap(() => this.api.complaints(this.adminParams())));
  editingId = signal<number | null>(null);
  title = '';
  content = '';
  phone = '';
  adminKeyword = '';
  processedFilter = '';
  images = signal<string[]>([]);
  uploading = signal(false);

  statusLabel(item: Complaint) {
    return item.is_processed ? '已处理' : '待处理';
  }

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.images().length >= 3) return;
    this.uploading.set(true);
    this.api.uploadComplaintImage(file).subscribe({
      next: result => this.images.update(items => [...items, result.url]),
      complete: () => this.uploading.set(false),
      error: () => this.uploading.set(false)
    });
    input.value = '';
  }

  removeImage(image: string) {
    this.images.update(items => items.filter(item => item !== image));
  }

  submit() {
    const [image1, image2, image3] = this.images();
    const payload = {
      title: this.title.trim(),
      content: this.content.trim(),
      phone: this.phone.trim(),
      image1,
      image2,
      image3
    };
    const request$ = this.editingId()
      ? this.api.updateComplaint(this.editingId()!, payload)
      : this.api.createComplaint(payload);
    request$.subscribe(() => {
      this.toast.show(this.editingId() ? '投诉与反馈已更新' : '投诉与反馈已提交');
      this.resetForm();
      this.reload();
    });
  }

  edit(item: Complaint) {
    if (item.is_processed) {
      this.toast.show('已处理的投诉与反馈不能再编辑');
      return;
    }
    this.editingId.set(item.id);
    this.title = item.title;
    this.content = item.content;
    this.phone = item.phone;
    this.images.set([item.image1, item.image2, item.image3].filter(Boolean) as string[]);
  }

  deleteComplaint(id: number) {
    if (!window.confirm('确认撤销这条投诉与反馈？')) return;
    this.api.deleteComplaint(id).subscribe(() => {
      this.toast.show('投诉与反馈已撤销');
      if (this.editingId() === id) this.resetForm();
      this.reload();
    });
  }

  resetForm() {
    this.editingId.set(null);
    this.title = '';
    this.content = '';
    this.phone = '';
    this.images.set([]);
  }

  reload() {
    this.reload$.next(Date.now());
  }

  private adminParams() {
    if (this.auth.role() !== 'admin') return undefined;
    const params: { processed?: string; keyword?: string } = {};
    if (this.processedFilter) params.processed = this.processedFilter;
    const keyword = this.adminKeyword.trim();
    if (keyword) params.keyword = keyword;
    return Object.keys(params).length ? params : undefined;
  }
}
