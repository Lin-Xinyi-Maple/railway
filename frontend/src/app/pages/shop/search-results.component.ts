import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  standalone: true,
  imports: [AsyncPipe, RouterLink, ProductCardComponent],
  template: `
    @if (keyword$ | async; as keyword) {
      <section class="page-head search-head">
        <div>
          <h1>信息检索</h1>
          <p>当前关键词：{{ keyword || '全部商品' }}</p>
        </div>
        <a class="ghost" routerLink="/home">返回首页</a>
      </section>
    }

    @if (products$ | async; as page) {
      @if (page.items.length) {
        <section class="product-grid">
          @for (product of page.items; track product.id) {
            <app-product-card [product]="product" />
          }
        </section>
      } @else {
        <section class="empty panel">没有找到符合条件的商品</section>
      }
    }
  `
})
export class SearchResultsComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  keyword$ = this.route.queryParamMap.pipe(map(params => params.get('keyword') || ''));
  products$ = this.keyword$.pipe(switchMap(keyword => this.api.products({ keyword, page: 1, page_size: 48 })));
}
