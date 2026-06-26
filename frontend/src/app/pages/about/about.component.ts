import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <section class="about-page">
      <div class="about-hero">
        <div>
          <p class="about-kicker">Freshfield Commerce 2026</p>
          <h1>鲜域农品电商系统 2026版</h1>
          <p>面向农产品交易、商家经营、自营监管与用户服务的一体化系统。</p>
        </div>
        <img src="assets/logo-freshfield.svg" alt="鲜域农品 logo">
      </div>

      <section class="about-grid">
        <article class="about-panel support-panel">
          <span class="about-index">01</span>
          <h2>平台支持</h2>
          <p>本网站由 DeepSeek、百度地图、QQ邮箱、华为云提供能力支持。</p>
          <div class="support-strip">
            @for (item of supportItems; track item.name) {
              <div class="support-item">
                <img [src]="item.icon" [alt]="item.name">
                <strong>{{ item.name }}</strong>
                <small>{{ item.desc }}</small>
              </div>
            }
          </div>
        </article>

        <article class="about-panel">
          <span class="about-index">02</span>
          <h2>支付方式</h2>
          <p>支持微信、支付宝、银联、Visa、MasterCard </p>
          <div class="payment-strip">
            @for (item of payments; track item.name) {
              <div><img [src]="item.icon" [alt]="item.name"><span>{{ item.name }}</span></div>
            }
          </div>
        </article>

        <article class="about-panel">
          <span class="about-index">03</span>
          <h2>网站特点</h2>
          <ul>
            <li>普通用户、商家、自营管理员分角色统一管理。</li>
            <li>商品详情、购物车、订单、付款、地址、个人中心流程完整。</li>
            <li>图像等信息由华为云 OBS 提供支持，安全可靠。</li>
            <li>邮箱验证码用于注册、找回密码、换绑邮箱和注销账号。</li>
            <li>AI 监管和 AI 智能客服让农产品信息更容易核验。</li>
          </ul>
        </article>

        <article class="about-panel tech-panel">
          <span class="about-index">04</span>
          <h2>技术栈</h2>
          <div class="tech-cloud">
            <span>Angular 21</span>
            <span>Flask RESTful API</span>
            <span>MySQL 8</span>
            <span>SQLAlchemy</span>
            <span>JWT 登录认证</span>
            <span>Huawei OBS</span>
            <span>QQ SMTP</span>
            <span>DeepSeek API</span>
          </div>
        </article>

        <article class="about-panel developer-panel">
          <span class="about-index">05</span>
          <h2>开发者信息</h2>
          <p>开发者：林昕毅 20241489</p>
          <p>项目类型：商务网站开发</p>
          <p>系统名称：鲜域农产品电商系统 2026版</p>
        </article>
      </section>
    </section>
  `
})
export class AboutComponent {
  supportItems = [
    { name: 'DeepSeek', desc: 'AI 监管与智能客服', icon: 'assets/about/logo.png' },
    { name: '百度地图', desc: '位置与地址能力', icon: 'assets/about/baidu-map.png' },
    { name: 'QQ邮箱', desc: '验证码邮件服务', icon: 'assets/about/qq-mail.png' },
    { name: '华为云 OBS', desc: '图像数据存储', icon: 'assets/about/huawei_logo.png' }
  ];

  payments = [
    { name: '微信支付', icon: 'assets/about/wechat-pay.png' },
    { name: '支付宝', icon: 'assets/about/alipay.png' },
    { name: '银联', icon: 'assets/about/unionpay.png' },
    { name: 'Visa', icon: 'assets/about/visa.png' },
    { name: 'MasterCard', icon: 'assets/about/mastercard.png' }
  ];
}
