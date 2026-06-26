import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, merge, startWith, switchMap, timer } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Account, FriendRelation } from '../../models/domain';

@Component({
  standalone: true,
  imports: [AsyncPipe, NgTemplateOutlet, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-head community-head">
      <div>
        <h1>社区</h1>
      </div>
    </section>

    <section class="community-layout">
      <aside class="panel friend-search-card">
        <h2>搜索好友</h2>
        <form [formGroup]="form" (ngSubmit)="search()">
          <label>好友邮箱
            <input formControlName="email" type="email" placeholder="请输入对方注册邮箱">
          </label>
          <button class="solid" [disabled]="form.invalid || loading()">搜索</button>
        </form>

        @if (result(); as account) {
          <article class="friend-result">
            <ng-container *ngTemplateOutlet="avatarTpl; context: { account: account }"></ng-container>
            <div>
              <strong>{{ account.nickname }}</strong>
              <small>{{ account.username }} · {{ account.email }}</small>
            </div>
            <button class="ghost" type="button" (click)="invite()">发送申请</button>
          </article>
        }
      </aside>

      @if (friends$ | async; as view) {
        <section class="community-board" id="friend-requests">
          <article class="panel community-column">
            <header>
              <h2>我的好友</h2>
              <span>{{ view.friends.length }}</span>
            </header>
            <div class="community-list">
              @for (friend of view.friends; track friend.id) {
                @if (friend.other; as account) {
                  <div class="community-person-row">
                    <ng-container *ngTemplateOutlet="avatarTpl; context: { account: account }"></ng-container>
                    <div>
                      <strong>{{ account.nickname }}</strong>
                      <small>{{ account.email }}</small>
                    </div>
                    <div class="community-actions">
                      <a class="ghost tiny-action" [routerLink]="['/messages', 'sender-' + account.id]" [queryParams]="{ name: account.nickname }">聊天</a>
                      <button class="ghost danger-text tiny-action" type="button" (click)="deleteFriend(friend.id)">删除</button>
                    </div>
                  </div>
                }
              } @empty {
                <div class="empty compact-empty">还没有好友</div>
              }
            </div>
          </article>

          <article class="panel community-column">
            <header>
              <h2>好友申请</h2>
              <span>{{ view.requests.length }}</span>
            </header>
            <div class="community-list">
              @for (request of view.requests; track request.id) {
                @if (requestAccount(request); as account) {
                  <div class="community-person-row request-row">
                    <ng-container *ngTemplateOutlet="avatarTpl; context: { account: account }"></ng-container>
                    <div>
                      <strong>
                        {{ account.nickname }}
                        <em>{{ request.direction === 'sent' ? '正在验证你的邀请' : '申请添加你为好友' }}</em>
                      </strong>
                      <small>{{ account.email }}</small>
                    </div>
                    @if (request.direction === 'sent') {
                      <span class="request-status">等待认证</span>
                    } @else {
                      <button class="solid tiny-action" type="button" (click)="accept(request.id)">同意</button>
                    }
                  </div>
                }
              } @empty {
                <div class="empty compact-empty">暂无好友申请</div>
              }
            </div>
          </article>
        </section>
      }
    </section>

    <ng-template #avatarTpl let-account="account">
      @if (account.avatar) {
        <img class="community-avatar" [src]="account.avatar" [alt]="account.nickname">
      } @else {
        <span class="community-avatar letter">{{ (account.nickname || account.username).slice(0, 1) }}</span>
      }
    </ng-template>
  `
})
export class AddFriendComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private reload$ = new Subject<void>();

  loading = signal(false);
  result = signal<Account | null>(null);
  friends$ = merge(this.reload$, timer(0, 2000)).pipe(startWith(undefined), switchMap(() => this.api.friends()));
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  search() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.api.searchAccountByEmail(this.form.value.email!).subscribe({
      next: account => {
        this.result.set(account);
        this.loading.set(false);
      },
      error: () => {
        this.result.set(null);
        this.loading.set(false);
      }
    });
  }

  invite() {
    if (!this.result()) return;
    this.api.inviteFriend(this.result()!.email).subscribe(() => {
      this.toast.show('好友申请已发送');
      this.reload$.next();
    });
  }

  accept(friendId: number) {
    this.api.acceptFriendRequest(friendId).subscribe(() => {
      this.toast.show('已同意好友申请');
      this.reload$.next();
    });
  }

  deleteFriend(friendId: number) {
    if (!window.confirm('确认删除这个好友并清空双方聊天记录？')) return;
    this.api.deleteFriend(friendId).subscribe(() => {
      this.toast.show('好友和聊天记录已删除');
      this.reload$.next();
    });
  }

  requestAccount(request: FriendRelation) {
    return request.direction === 'sent' ? request.receiver : request.applicant;
  }
}
