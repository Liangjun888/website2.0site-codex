// Gold Summit Capital — main.js
// 仅两项交互：移动端菜单、区块进入视口显现。禁止在此文件添加其他动效（规范第 10 节）。

(function () {
  // 移动端菜单
  var btn = document.querySelector('.menu-btn');
  var nav = document.querySelector('.mobile-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '关闭' : '菜单';
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  // 滚动显现（尊重 prefers-reduced-motion）
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sections = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    sections.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  sections.forEach(function (el) { io.observe(el); });
})();
