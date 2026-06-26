import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, startWith, switchMap } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  template: `
    <section class="home-search panel">
      <input [formControl]="keyword" placeholder="搜索产品或商家名称">
      <button class="solid" type="button" (click)="search()">搜索</button>
      @if (suggestions$ | async; as suggestions) {
        @if (keyword.value && suggestions.items.length) {
          <div class="search-suggestions">
            @for (product of suggestions.items; track product.id) {
              <button type="button" (click)="useSuggestion(product.name)">
                <span>{{ product.name }}</span>
                <small>{{ product.shop_name }} · {{ product.origin }}</small>
              </button>
            }
          </div>
        }
      }
    </section>

    <section class="market-carousel poster-carousel home-carousel" aria-label="首页轮播图">
      <div class="carousel-track" [style.transform]="'translateX(-' + activeSlide * 100 + '%)'">
        @for (slide of carouselSlides; track slide.image) {
          <article class="poster-slide" [class.light]="slide.tone === 'light'">
            <img [src]="slide.image" [alt]="slide.alt">
            <div class="poster-orbit" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <div class="poster-copy">
              <span class="poster-kicker">{{ slide.kicker }}</span>
              <h1>{{ slide.title }}</h1>
              <p>{{ slide.subtitle }}</p>
              <div class="poster-points">
                @for (point of slide.points; track point) { <span>{{ point }}</span> }
              </div>
              <button class="poster-cta" type="button" (click)="goRecommend()">立即选购</button>
            </div>
          </article>
        }
      </div>
      <button class="carousel-arrow prev" type="button" aria-label="上一张" (click)="prevSlide()">‹</button>
      <button class="carousel-arrow next" type="button" aria-label="下一张" (click)="nextSlide()">›</button>
      <div class="carousel-dots" aria-label="轮播分页">
        @for (slide of carouselSlides; track slide.image; let i = $index) {
          <button type="button" [class.active]="i === activeSlide" [attr.aria-label]="'第 ' + (i + 1) + ' 张'" (click)="goSlide(i)"></button>
        }
      </div>
    </section>

    <section class="home-feature-strip home-reveal-left" aria-label="平台服务">
      @for (item of featureStrip; track item.title) {
        <article>
          <span>{{ item.index }}</span>
          <div>
            <strong>{{ item.title }}</strong>
            <p>{{ item.text }}</p>
          </div>
        </article>
      }
    </section>

    <section class="home-broadcast panel home-reveal-right" aria-label="公告">
      <strong>公告</strong>
      <div class="home-broadcast-viewport">
        <div class="home-broadcast-track">
          @for (item of broadcasts; track item) {
            <span>{{ item }}</span>
          }
          @for (item of broadcasts; track item + '-loop') {
            <span aria-hidden="true">{{ item }}</span>
          }
        </div>
      </div>
      <button type="button" (click)="goRecommend()">去看看</button>
    </section>

    <section class="home-showcase-grid home-reveal-left">
      @for (item of showcaseCards; track item.title) {
        <article class="home-showcase-card" [style.background-image]="'url(' + item.image + ')'">
          <div>
            <span>{{ item.kicker }}</span>
            <h2>{{ item.title }}</h2>
            <p>{{ item.text }}</p>
          </div>
        </article>
      }
    </section>

    <section class="home-editorial home-reveal-right">
      <div class="home-section-heading">
        <span>Freshfield Focus</span>
        <h2>把农产品电商做成高度透明多重监管</h2>
        <p>让鲜域农品成为你的日常伴侣</p>
      </div>
      <div class="home-editorial-grid">
        <article class="home-editorial-main">
          <img src="assets/home4.png" alt="自营优选农品">
          <div>
            <span>自营优选+优质第三方商家</span>
            <h3>从商品到订单，每一步都看得见</h3>
            <button type="button" (click)="goRecommend()">去看看</button>
          </div>
        </article>
        <div class="home-editorial-side">
          @for (item of editorialCards; track item.title) {
            <article>
              <span>{{ item.kicker }}</span>
              <strong>{{ item.title }}</strong>
              <p>{{ item.text }}</p>
            </article>
          }
        </div>
      </div>
    </section>

    <section class="home-topic-wall home-reveal-left" aria-label="农品专题">
      @for (item of topicWall; track item.title) {
        <article [style.background-image]="'url(' + item.image + ')'">
          <span>{{ item.kicker }}</span>
          <h3>{{ item.title }}</h3>
        </article>
      }
    </section>

    <section class="home-flow panel home-reveal-right">
      <div class="home-section-heading">
        <span>Service Flow</span>
        <h2>从浏览到售后，形成极致电商体验</h2>
      </div>
      <div class="home-flow-steps">
        @for (item of flowSteps; track item.title) {
          <article>
            <i>{{ item.index }}</i>
            <strong>{{ item.title }}</strong>
            <p>{{ item.text }}</p>
          </article>
        }
      </div>
    </section>

    <section class="home-cta-band home-reveal-left">
      <img src="assets/home9.png" alt="进入推荐页">
      <div class="home-cta-copy">
        <span>Fresh Every Day</span>
        <h2>进入推荐页，去探索更多</h2>
      </div>
      <button type="button" (click)="goRecommend()">去看看</button>
    </section>
  `
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private api = inject(ApiService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private slideTimer?: number;
  private revealObserver?: IntersectionObserver;
  keyword = new FormControl('', { nonNullable: true });
  suggestions$ = this.keyword.valueChanges.pipe(
    startWith(''),
    debounceTime(250),
    switchMap(keyword => this.api.products({ keyword, page: 1, page_size: 6 }))
  );
  activeSlide = 0;
  carouselSlides = [
    {
      image: 'assets/poster-cherry.png',
      alt: '车厘子促销海报',
      tone: 'dark',
      kicker: 'SEASONAL CHERRY',
      title: '当季车厘子 鲜甜上新',
      subtitle: '颗颗饱满，冷链直达，把红宝石般的清甜送到餐桌。',
      points: ['产地优选', '甜润多汁', '限时尝鲜']
    },
    {
      image: 'assets/poster-apple.png',
      alt: '红富士苹果促销海报',
      tone: 'light',
      kicker: 'CRISP APPLE',
      title: '红富士脆甜 满口新鲜',
      subtitle: '清爽果香与细腻口感，适合家庭日常与礼盒搭配。',
      points: ['限时优惠', '清甜爽脆', '多种可选']
    },
    {
      image: 'assets/poster-durian.png',
      alt: '金枕榴莲促销海报',
      tone: 'warm',
      kicker: 'GOLDEN DURIAN',
      title: '金枕榴莲 软糯浓香',
      subtitle: '金黄饱满，香气绵密，热带果王的满足感一口到位。',
      points: ['新品上市', '软糯香甜', '规格可选']
    }
  ];
  featureStrip = [
    { index: '01', title: '产地直达', text: '从源头筛选店铺与农品，减少中间环节。' },
    { index: '02', title: '平台监管', text: 'AI辅助判别产品真实度，辅助购买。' },
    { index: '03', title: '售后联络', text: '商家不推脱，售后有保障。' },
    { index: '04', title: '数据看板', text: '平台自动统计用户、商家活动数据视图。' }
  ];
  showcaseCards = [
    {
      image: 'assets/home3.png',
      kicker: 'Fresh Pick',
      title: '当季鲜果专区',
      text: '快去看看正在热卖的季节农品，物美价廉。'
    },
    {
      image: 'assets/home2.png',
      kicker: 'Self Support',
      title: '平台自营保障',
      text: '平台自营，产地直发，品质有保障。'
    },
    {
      image: 'assets/home1.png',
      kicker: 'Merchant Market',
      title: '优选商家集市',
      text: '平台精选优质商家，AI人工双重审核。'
    }
  ];
  broadcasts = [
    '新鲜好物全新上线！',
    '饱满蓝莓、脆甜车厘子、清甜苹果、软糯榴莲多款时令鲜果齐聚，颗粒饱满、果香浓郁，每一口都是自然原生风味。',
    '优质地道大米，米粒油润软糯，煮饭喷香。',
    '产地直供，新鲜直达，从解馋鲜果到三餐主食一站式配齐，品质放心、价格实在，在家轻松囤齐四季美味，给餐桌添满满自然鲜香。'
  ];
  editorialCards = [
    { kicker: 'Quality', title: '商品信息集中展示', text: '价格、库存、产地、储存条件、评价和商家信息形成完整商品档案。' },
    { kicker: 'Trust', title: '投诉反馈闭环', text: '提交投诉和反馈，有问必答，有求必应，平台治理更清晰。' },
    { kicker: 'Data', title: '数据可视化', text: '订单、销售额、低库存和增长趋势帮助经营规划。' }
  ];
  topicWall = [
    { image: 'assets/home5.png', kicker: 'Tropical', title: '热带水果季' },
    { image: 'assets/home7.png', kicker: 'Seasonal', title: '应季尝鲜' },
    { image: 'assets/home8.png', kicker: 'Daily', title: '家庭日常采购' },
    { image: 'assets/home6.png', kicker: 'Gift', title: '礼盒优选' }
  ];
  flowSteps = [
    { index: '01', title: '发现商品', text: '首页轮播、搜索建议等进入商品详情。' },
    { index: '02', title: '加入购物车', text: '用户收藏或加入购物车，形成后续购买路径。' },
    { index: '03', title: '确认支付', text: '选择地址和支付方式，订单进入处理状态。' },
    { index: '04', title: '评价售后', text: '收货后评价，售后通过消息和投诉反馈继续处理。' }
  ];

  ngOnInit() {
    this.slideTimer = window.setInterval(() => this.nextSlide(), 4500);
  }

  ngAfterViewInit() {
    const targets = this.host.nativeElement.querySelectorAll('.home-reveal-left, .home-reveal-right');
    this.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        this.revealObserver?.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((target: Element) => this.revealObserver?.observe(target));
  }

  ngOnDestroy() {
    if (this.slideTimer) window.clearInterval(this.slideTimer);
    this.revealObserver?.disconnect();
  }

  search() {
    this.router.navigate(['/search'], { queryParams: { keyword: this.keyword.value } });
  }

  useSuggestion(value: string) {
    this.keyword.setValue(value);
    this.router.navigate(['/search'], { queryParams: { keyword: value } });
  }

  goRecommend() {
    this.router.navigateByUrl('/shop');
  }

  prevSlide() {
    this.activeSlide = (this.activeSlide - 1 + this.carouselSlides.length) % this.carouselSlides.length;
  }

  nextSlide() {
    this.activeSlide = (this.activeSlide + 1) % this.carouselSlides.length;
  }

  goSlide(index: number) {
    this.activeSlide = index;
  }
}
