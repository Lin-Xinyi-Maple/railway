import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Category, Product, Shop } from '../../models/domain';
import { ImageCropperComponent } from '../../shared/image-cropper.component';

type ImageField = 'main_image' | 'image_2' | 'image_3';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, ImageCropperComponent],
  template: `
    <section class="page-head detail-head">
      <div>
        <a class="back-link" routerLink="/merchant/products">返回商品列表</a>
        <h1>{{ isEdit ? '编辑商品' : '发布商品' }}</h1>
      </div>
    </section>

    @if (loaded()) {
      <form class="panel merchant-form product-editor-form" (ngSubmit)="save()">
        <section class="product-image-editor">
          @for (field of imageFields; track field.key) {
            <div>
              @if (draft[field.key]) {
                <img [src]="draft[field.key]" [alt]="field.label">
              } @else {
                <span>{{ field.label }}</span>
              }
              <button class="ghost" type="button" (click)="pick(field.key, fileInput)">上传{{ field.label }}</button>
            </div>
          }
          <input #fileInput hidden type="file" accept="image/*" (change)="onImageSelected($event)">
        </section>

        <div class="merchant-form-grid">
          <label>商品名称<input [(ngModel)]="draft.name" name="name" required></label>
          <label>分类
            <select [(ngModel)]="draft.category_id" name="category_id" required>
              @for (category of categories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
          </label>
          <label>价格<input type="number" step="0.01" min="0" [(ngModel)]="draft.price" name="price" required></label>
          <label>单位<input [(ngModel)]="draft.unit" name="unit" required></label>
          <label>库存<input type="number" min="0" [(ngModel)]="draft.stock" name="stock" required></label>
          <label>预警库存<input type="number" min="0" [(ngModel)]="draft.warning_stock" name="warning_stock" required></label>
          <label>产地<input [(ngModel)]="draft.origin" name="origin"></label>
          <label>种植方式<input [(ngModel)]="draft.planting_method" name="planting_method"></label>
          <label>保质期天数<input type="number" min="0" [(ngModel)]="draft.shelf_life_days" name="shelf_life_days"></label>
          <label>储存条件<input [(ngModel)]="draft.storage_condition" name="storage_condition"></label>
          <label>状态
            <select [(ngModel)]="draft.status" name="status">
              <option value="on_sale">on_sale</option>
              <option value="off_sale">off_sale</option>
              <option value="disabled" [disabled]="true">disabled</option>
            </select>
          </label>
        </div>
        <label>商品详情<textarea rows="8" [(ngModel)]="draft.detail" name="detail"></textarea></label>
        <button class="solid" type="submit">{{ isEdit ? '修改' : '发布' }}</button>
      </form>
    }

    @if (cropSource()) {
      <app-image-cropper title="裁剪商品图片" [imageSrc]="cropSource()" (cancel)="cropSource.set('')" (cropped)="saveCrop($event)" />
    }
  `
})
export class MerchantProductFormComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  productId = Number(this.route.snapshot.paramMap.get('id'));
  isEdit = !!this.productId;
  loaded = signal(false);
  categories = signal<Category[]>([]);
  shop = signal<Shop | null>(null);
  cropSource = signal('');
  activeImageField: ImageField = 'main_image';
  imageFields: { key: ImageField; label: string }[] = [
    { key: 'main_image', label: '主图' },
    { key: 'image_2', label: '图片1' },
    { key: 'image_3', label: '图片2' },
  ];
  draft: Partial<Product> = {
    name: '',
    category_id: 0,
    main_image: '',
    image_2: '',
    image_3: '',
    detail: '',
    price: 0,
    unit: '',
    stock: 0,
    warning_stock: 10,
    origin: '',
    planting_method: '',
    shelf_life_days: 0,
    storage_condition: '',
    status: 'on_sale'
  };

  constructor() {
    forkJoin({
      categories: this.api.categories(),
      shop: this.api.merchantShop(),
      product: this.isEdit ? this.api.product(this.productId) : of(null)
    }).subscribe(({ categories, shop, product }) => {
      this.categories.set(categories);
      this.shop.set(shop);
      if (!this.isEdit) {
        this.draft.shop_id = shop.id;
        this.draft.category_id = categories[0]?.id || 0;
      } else if (product) {
        this.draft = { ...product };
      }
      this.loaded.set(true);
    });
  }

  pick(field: ImageField, input: HTMLInputElement) {
    this.activeImageField = field;
    input.click();
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.cropSource.set(String(reader.result || ''));
    reader.readAsDataURL(file);
    input.value = '';
  }

  saveCrop(blob: Blob) {
    const file = new File([blob], 'product.png', { type: 'image/png' });
    this.api.uploadProductImage(file).subscribe(result => {
      this.draft[this.activeImageField] = result.url;
      this.cropSource.set('');
      this.toast.show('图片已上传');
    });
  }

  save() {
    const payload = {
      ...this.draft,
      shop_id: this.shop()?.id || this.draft.shop_id,
      price: Number(this.draft.price || 0),
      stock: Number(this.draft.stock || 0),
      warning_stock: Number(this.draft.warning_stock || 0),
      shelf_life_days: Number(this.draft.shelf_life_days || 0)
    };
    const request$ = this.isEdit ? this.api.updateProduct(this.productId, payload) : this.api.createProduct(payload);
    request$.subscribe(() => {
      this.toast.show(this.isEdit ? '商品已修改' : '商品已发布');
      this.router.navigateByUrl('/merchant/products');
    });
  }
}
