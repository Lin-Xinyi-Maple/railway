import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, startWith, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, ProductCardComponent],
  template: `
    <section class="page-head recommend-head">
      <h1>推荐农品</h1>
    </section>

    <section class="toolbar panel recommend-toolbar" id="products">
      <select [formControl]="categoryId" aria-label="按分类筛选">
        <option value="">全部分类</option>
        @for (cat of categories$ | async; track cat.id) {
          <option [value]="cat.id">{{ cat.name }}</option>
        }
      </select>
      <select [formControl]="shopType" aria-label="按店铺类型筛选">
        <option value="">全部店铺</option>
        <option value="self">平台自营</option>
        <option value="merchant">普通商家</option>
      </select>
      <select [formControl]="sort" aria-label="按排序方式筛选">
        <option value="newest">发布时间：最新</option>
        <option value="oldest">发布时间：最早</option>
        <option value="paid_users">付款人数优先</option>
        <option value="comments">评论数优先</option>
        <option value="price_asc">价格从低到高</option>
        <option value="price_desc">价格从高到低</option>
      </select>
    </section>

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
export class ShopComponent {
  private api = inject(ApiService);
  categoryId = new FormControl('', { nonNullable: true });
  shopType = new FormControl('', { nonNullable: true });
  sort = new FormControl('newest', { nonNullable: true });
  categories$ = this.api.categories();
  products$ = combineLatest([
    this.categoryId.valueChanges.pipe(startWith('')),
    this.shopType.valueChanges.pipe(startWith('')),
    this.sort.valueChanges.pipe(startWith('newest'))
  ]).pipe(
    switchMap(([category_id, shop_type, sort]) => this.api.products({ category_id, shop_type, sort, page: 1, page_size: 48 }))
  );
}
