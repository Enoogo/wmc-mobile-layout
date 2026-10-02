// ==UserScript==
// @name         WMC/NMC 城市天气页 · 手机重排
// @name:en      WMC/NMC City Weather Page · Mobile Relayout
// @namespace    https://www.wmc-bj.net/
// @version      1.5.1
// @description  仅限 www.wmc-bj.net 英文站（中文站 www.nmc.cn 请用 nmc-cn-mobile-layout.user.js）。隐藏顶部导航/Logo与页脚（地址/版权/Powered by/Maintenance全部删除），内容区=屏幕宽度（上限480px居中），从实况开始：实况（日出日落弧线居中） → 7天预报 → 逐小时 → 气候信息 → 源网页搜索框。7天保持原排列、一次显示4列；逐小时格子在窄屏加宽一半（一屏约2.7列），均可左右滑动；点日期跳转逐小时时该日第一列精确左对齐（并修复源站跳转后无法回划的bug）。产品及以下内容全部删除。兼容 Via（安卓）/Tampermonkey，无 GM_* 依赖。
// @author       Cebian
// @match        *://www.wmc-bj.net/publish/weather/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
   * 1. 样式
   * ============================================================ */
  var CSS = [
    /* overflow-x:hidden 保险：杜绝整页左右滑动（模块内部横滑不受影响） */
    'html, body { -webkit-text-size-adjust: 100%; overflow-x: hidden; }',
    'body { min-width: 0 !important; width: 100% !important; max-width: 100% !important; }',

    /* 内容区 = 屏幕宽度（上限 480px 居中）：电脑=480居中，手机=铺满屏幕 */
    '.container { width: 100% !important; max-width: 100% !important; box-sizing: border-box; }',
    'body > .container { width: 100% !important; max-width: 480px !important; margin: 0 auto !important; padding: 0 0 24px !important; box-sizing: border-box; }',

    /* 顶部导航、Logo、页脚整块不显示（页脚再由 JS 真删） */
    'body > .nmc-top-nav { display: none !important; }',
    '.wmcbj-footer { display: none !important; }',

    /* 重排舞台：模块竖向排列，模块与内部栅格均铺满整屏 */
    '.wmc-stack { display: block; width: 100%; }',
    '.wmc-stack > * { width: 100% !important; max-width: 100% !important; float: none !important; display: block; box-sizing: border-box; margin-left: 0 !important; margin-right: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }',
    '.wmc-stack .row { margin-left: 0 !important; margin-right: 0 !important; }',
    '.wmc-stack .row > [class*="col-xs-"] { width: 100% !important; float: none !important; }',

    /* 实况卡片：整块铺满；内部保持原有三栏 */
    '.cityreal { padding-left: 0 !important; padding-right: 0 !important; }',
    '.cityreal .row > [class*="col-xs-"] { float: left !important; }',
    '.cityreal .row > .col-xs-3  { width: 25% !important; }',
    '.cityreal .row > .col-xs-4  { width: 33.3333% !important; }',
    '.cityreal .row > .col-xs-9  { width: 75% !important; }',
    '.cityreal .row > .col-xs-12 { width: 100% !important; }',

    /* 日出日落弧线块（站点定宽 389px）→ 居中显示，窄屏按比例缩小 */
    '.cityreal .rcrl { margin: 0 auto !important; max-width: 100% !important; background-size: contain !important; }',

    /* 7 天预报：保持原列式排列，一次 4 列，左右滑动（width:100% 防止窄屏下塌缩成 0 宽） */
    '#day7 { display: flex !important; flex-wrap: nowrap !important; width: 100% !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; }',
    '#day7 .weather { flex: 0 0 25% !important; width: 25% !important; max-width: 25% !important; height: auto !important; float: none !important; box-sizing: border-box; }',
    '#day7 .weatherWrap { height: auto !important; }',

    /* 逐小时：图例固定左侧（100px 加宽 1/5 = 120px），数据格子宽度由 sizeHourly() 决定（窄屏加宽一半），左右滑动 */
    '.hourItems { display: block !important; float: none !important; width: 100% !important; clear: both; overflow: hidden; }',
    '.hourItems .texts { width: 120px !important; float: left !important; }',
    '.hourItems .texts .text { font-size: 11px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '.hourItems #hourValues {',
    '  width: calc(100% - 120px) !important; float: left !important;',
    '  overflow-x: auto !important; overflow-y: hidden; overflow-anchor: none;',
    '  -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y;',
    '}',
    /* 图例行与数据行强制等高、同边距，保证逐行对齐 */
    '.hourItems .texts .text, .hourItems .hour3 > div { height: 48px !important; margin: 0 !important; box-sizing: border-box; }',
    '.hourItems .texts .text { line-height: 48px; }',
    '.hourItems .hour3 > div { display: flex; align-items: center; justify-content: center; font-size: 11px; white-space: nowrap; overflow: hidden; }',
    '.hourItems .hourimg img { width: 32px !important; height: 32px !important; }',

    /* 点日期跳转改用 scrollLeft（见 bindJump）：禁用源站的 left 硬移——
       它按 672px/天 估算必偏，且负 left 会把左边内容推出滚动区、跳完无法往左回划（源站固有 bug） */
    '#hourValues > div { left: 0 !important; }',

    /* 页面最底下：源网页自带的搜索框（整块搬来，只挪位置不改功能） */
    '.wmc-stack .wmc-search { min-height: 52px; }',
    '.wmc-stack .wmc-search .search-wrapper { float: none !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; box-sizing: border-box; }',
    '.wmc-stack .wmc-search input { max-width: 100% !important; box-sizing: border-box; }',

    /* Highcharts 横向滚动兜底 */
    '.wmc-scrollx { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('wmc-mobile-css')) return;
    var st = document.createElement('style');
    st.id = 'wmc-mobile-css';
    st.type = 'text/css';
    st.appendChild(document.createTextNode(CSS));
    document.head.appendChild(st);
  }

  /* ============================================================
   * 2. viewport：页面没有 meta viewport，手机上会被缩放成桌面版
   * ============================================================ */
  function ensureViewport() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.name = 'viewport';
      document.head.appendChild(m);
    }
    m.setAttribute('content', 'width=device-width, initial-scale=1');
  }

  /* ============================================================
   * 3. 页脚删除：.wmcbj-footer 整块（Address/Zip/Email/版权/Powered by/Maintenance）
   *    兜底：老式页脚无 class，按文字反查 body 直属 div（限定范围防误删大容器）
   * ============================================================ */
  function removeFooter() {
    Array.prototype.forEach.call(document.querySelectorAll('.wmcbj-footer'), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.tagName !== 'DIV') return;
      if (el.classList.contains('container')) return;
      if (/Beijing ICP|National Meteorological Centre Copyright/.test(el.textContent || '')) {
        el.remove();
      }
    });
  }

  /* ============================================================
   * 4. 逐小时列宽：固定为可视区 4 列（极窄时 2 列兜底；随切日期重绘需重复调用）
   * ============================================================ */
  function sizeHourly() {
    var vals = document.querySelector('#hourValues');
    if (!vals) return;
    var cols = vals.querySelectorAll('.hour3');
    if (!cols.length) return;
    var avail = vals.clientWidth;
    if (!avail) return;
    /* 列宽 = 一屏 4 列；窄屏（avail < 330，即一屏放不下 4 个舒适格子）格子再加大一半，
       一屏约可见 2.7 列，左右滑动看其余。想更宽就调大 1.5 这个倍数 */
    var w = Math.floor(avail / 4);
    if (avail < 330) w = Math.floor(w * 1.5);
    if (w < 55) w = 55;
    var total = 0;
    Array.prototype.forEach.call(cols, function (c) {
      c.style.width = w + 'px';
      total += w;
    });
    var inner = vals.firstElementChild;
    if (inner) {
      inner.style.width = total + 'px';
      inner.style.left = '0px'; /* 保持内容在滚动区内（防源站 left 硬移残留） */
      Array.prototype.forEach.call(inner.children, function (g) {
        if (!g.querySelectorAll) return;
        var n = g.querySelectorAll('.hour3').length;
        if (n) g.style.width = (w * n) + 'px';
      });
    }
  }

  /* ============================================================
   * 5. DOM 重排（只搬节点，不重建元素，保留所有事件监听）
   *    最终页面：实况 → 标题+7天+逐小时 → 气候信息
   *    产品及其余内容（搜索框/地图/预警/资讯）全部删除
   * ============================================================ */
  function colSpan(el) {
    var m = /col-(?:xs|sm|md|lg)-(\d+)/.exec(el.className || '');
    return m ? parseInt(m[1], 10) : 0;
  }

  function isCol(el) {
    return /col-(?:xs|sm|md|lg)-/.test(el.className || '');
  }

  function relayout() {
    if (document.querySelector('.wmc-stack')) return true; // 已完成

    var day7 = document.querySelector('#day7');
    var cityreal = document.querySelector('.cityreal');
    if (!day7 || !cityreal) return false;

    var colMain = day7.closest('[class*="col-"]') || day7.parentElement;
    if (!colMain) return false;

    var container = colMain.closest('.container');
    if (!container) return false;

    var row1 = colMain.parentElement;
    var rows = Array.prototype.slice.call(container.children).filter(function (e) {
      return e.classList.contains('row');
    });
    if (!rows.length) return false;

    // 气候信息 = 第一行之外、按文档顺序最靠前的宽栏
    var climate = null;
    rows.forEach(function (row) {
      if (row === row1 || climate) return;
      var cols = Array.prototype.slice.call(row.children).filter(isCol);
      cols.sort(function (a, b) { return colSpan(b) - colSpan(a); });
      if (cols[0]) climate = cols[0];
    });

    var stage = document.createElement('div');
    stage.className = 'wmc-stack';
    stage.appendChild(cityreal);              // 1) 实况置顶
    stage.appendChild(colMain);               // 2) 地点标题 + 7 天 + 逐小时
    if (climate) stage.appendChild(climate);  // 3) 气候信息

    // 4) 页面最底下：源网页自带的搜索框（整块搬来，保留原功能；须在删行前抢救）
    var searchInput = document.querySelector('#searchInput');
    var searchBox = searchInput && (searchInput.closest('.search-wrapper') || searchInput.parentElement);
    if (searchBox) {
      var searchWrap = document.createElement('div');
      searchWrap.className = 'wmc-search';
      searchWrap.appendChild(searchBox);
      stage.appendChild(searchWrap);
    }

    container.insertBefore(stage, container.firstChild);

    // 产品及以下全部删除（连同搜索框、地图、预警、资讯）
    rows.forEach(function (row) {
      if (row.parentNode) row.parentNode.removeChild(row);
    });
    removeFooter();
    return true;
  }

  /* ============================================================
   * 6. 图表自适应（Highcharts）
   * ============================================================ */
  function reflowCharts() {
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    try {
      if (window.Highcharts && Highcharts.charts) {
        Highcharts.charts.forEach(function (c) {
          if (c) { try { c.reflow(); } catch (e) {} }
        });
      }
    } catch (e) {}
    try {
      Array.prototype.forEach.call(document.querySelectorAll('.highcharts-container'), function (hc) {
        var w = hc.parentElement;
        if (w && w !== document.body) w.classList.add('wmc-scrollx');
      });
    } catch (e) {}
  }

  function refresh() {
    sizeHourly();
    reflowCharts();
  }

  /* ============================================================
   * 7. 启动 + 动态内容安全网
   * ============================================================ */
  /* 点日期 → 逐小时精确跳转：让该日第一列（如 "02 02:00"）与最左边对齐。
   * 做法：不用源站的 left 硬移（672px/天 估算必偏 + 负 left 后无法回划），
   * 改为把 #day{i} 的真实偏移写进 scrollLeft；委托监听在 document 上，节点重绘也有效 */
  function bindJump() {
    if (document.documentElement.getAttribute('data-wmc-jump')) return;
    document.documentElement.setAttribute('data-wmc-jump', '1');
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var w = t.closest('#day7 .weather');
      if (!w) return;
      var day7 = document.querySelector('#day7');
      var vals = document.querySelector('#hourValues');
      var inner = vals && vals.firstElementChild;
      if (!day7 || !vals || !inner) return;
      var idx = Array.prototype.indexOf.call(day7.querySelectorAll('.weather'), w);
      var group = inner.children[idx];
      if (idx < 0 || !group) return;
      alignGroup(vals, group);
      /* 站点随后会改写 #selectdate 引发布局微移（滚动锚定），补校两次保证严丝合缝 */
      setTimeout(function () { alignGroup(vals, group); }, 250);
      setTimeout(function () { alignGroup(vals, group); }, 550);
    }, false);
  }

  /* 差多少补多少：把 group 的左边缘精确对齐 #hourValues 视口左缘（自校正，可重复调用） */
  function alignGroup(vals, group) {
    var inner = vals.firstElementChild;
    if (inner) inner.style.left = '0px';
    var d = group.getBoundingClientRect().left - vals.getBoundingClientRect().left;
    if (Math.abs(d) > 0.5) {
      vals.scrollLeft = Math.max(0, Math.min(vals.scrollLeft + d, vals.scrollWidth - vals.clientWidth));
    }
  }

  function boot() {
    injectCSS();
    bindJump();
    ensureViewport();
    removeFooter();

    // 页面数据是 AJAX 填充的，模块可能晚到，轮询直到重排成功
    var tries = 0;
    (function tick() {
      tries++;
      if (relayout()) {
        refresh();
        setTimeout(refresh, 600);
        setTimeout(refresh, 1500);
        return;
      }
      if (tries < 60) setTimeout(tick, 500);
    })();

    // 安全网：站点脚本重建结构（如切换日期重绘逐小时）时自动补排/重调列宽
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        if (!document.querySelector('.wmc-stack')) relayout();
        removeFooter();
        refresh();
      }, 300);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('load', function () { setTimeout(refresh, 300); });
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', function () { setTimeout(refresh, 300); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
