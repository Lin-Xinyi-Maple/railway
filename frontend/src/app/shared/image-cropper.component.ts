import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal } from '@angular/core';

@Component({
  selector: 'app-image-cropper',
  standalone: true,
  template: `
    <div class="crop-backdrop">
      <section class="crop-dialog panel">
        <div class="crop-head">
          <div>
            <h2>{{ title }}</h2>
          </div>
          <button type="button" class="ghost" (click)="cancel.emit()">取消</button>
        </div>

        <div class="crop-stage" #stage (pointerdown)="startDrag($event)" (pointermove)="drag($event)" (pointerup)="stopDrag()" (pointerleave)="stopDrag()">
          <img
            #image
            [src]="imageSrc"
            alt="待裁剪图片"
            [style.width.px]="displayWidth()"
            [style.height.px]="displayHeight()"
            [style.transform]="'translate(' + offsetX() + 'px,' + offsetY() + 'px)'"
            (load)="prepareImage()"
          >
          <div class="crop-frame"></div>
        </div>

        <label class="crop-zoom">
          缩放
          <input type="range" min="1" max="3" step="0.01" [value]="zoom()" (input)="setZoom($event)">
        </label>
        <button type="button" class="solid wide" (click)="save()">保存并上传</button>
      </section>
    </div>
  `
})
export class ImageCropperComponent {
  @Input({ required: true }) imageSrc = '';
  @Input() title = '裁剪图片';
  @Output() cancel = new EventEmitter<void>();
  @Output() cropped = new EventEmitter<Blob>();
  @ViewChild('image') imageRef?: ElementRef<HTMLImageElement>;

  cropSize = 360;
  naturalWidth = 1;
  naturalHeight = 1;
  baseScale = 1;
  zoom = signal(1);
  offsetX = signal(0);
  offsetY = signal(0);
  displayWidth = signal(360);
  displayHeight = signal(360);
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startOffsetX = 0;
  private startOffsetY = 0;

  prepareImage() {
    const image = this.imageRef?.nativeElement;
    if (!image) return;
    this.naturalWidth = image.naturalWidth || 1;
    this.naturalHeight = image.naturalHeight || 1;
    this.baseScale = this.cropSize / Math.min(this.naturalWidth, this.naturalHeight);
    this.zoom.set(1);
    this.updateDisplay();
    this.centerImage();
  }

  setZoom(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    const centerX = this.cropSize / 2;
    const centerY = this.cropSize / 2;
    const oldScale = this.currentScale();
    const sourceCenterX = (centerX - this.offsetX()) / oldScale;
    const sourceCenterY = (centerY - this.offsetY()) / oldScale;
    this.zoom.set(value);
    this.updateDisplay();
    const nextScale = this.currentScale();
    this.offsetX.set(centerX - sourceCenterX * nextScale);
    this.offsetY.set(centerY - sourceCenterY * nextScale);
    this.clampOffsets();
  }

  startDrag(event: PointerEvent) {
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.startOffsetX = this.offsetX();
    this.startOffsetY = this.offsetY();
  }

  drag(event: PointerEvent) {
    if (!this.dragging) return;
    this.offsetX.set(this.startOffsetX + event.clientX - this.dragStartX);
    this.offsetY.set(this.startOffsetY + event.clientY - this.dragStartY);
    this.clampOffsets();
  }

  stopDrag() {
    this.dragging = false;
  }

  save() {
    const image = this.imageRef?.nativeElement;
    if (!image) return;
    const scale = this.currentScale();
    const sourceX = Math.max(0, -this.offsetX() / scale);
    const sourceY = Math.max(0, -this.offsetY() / scale);
    const sourceSize = Math.min(this.cropSize / scale, this.naturalWidth - sourceX, this.naturalHeight - sourceY);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 800, 800);
    canvas.toBlob(blob => {
      if (blob) this.cropped.emit(blob);
    }, 'image/png', 0.92);
  }

  private currentScale() {
    return this.baseScale * this.zoom();
  }

  private updateDisplay() {
    const scale = this.currentScale();
    this.displayWidth.set(this.naturalWidth * scale);
    this.displayHeight.set(this.naturalHeight * scale);
  }

  private centerImage() {
    this.offsetX.set((this.cropSize - this.displayWidth()) / 2);
    this.offsetY.set((this.cropSize - this.displayHeight()) / 2);
    this.clampOffsets();
  }

  private clampOffsets() {
    const maxX = 0;
    const maxY = 0;
    const minX = this.cropSize - this.displayWidth();
    const minY = this.cropSize - this.displayHeight();
    this.offsetX.set(Math.min(maxX, Math.max(minX, this.offsetX())));
    this.offsetY.set(Math.min(maxY, Math.max(minY, this.offsetY())));
  }
}
