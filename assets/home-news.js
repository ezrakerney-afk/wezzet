(() => {
  const carousel = document.getElementById('website-news');
  const slides = [...carousel.querySelectorAll('.news-slide')];
  const controls = carousel.querySelector('.news-controls');
  const dots = carousel.querySelector('.news-dots');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;

  // Keep the extension first, then shuffle the announcement rotation.
  const order = slides.map((_, index) => index);
  for (let index = order.length - 1; index > 1; index--) {
    const other = 1 + Math.floor(Math.random() * index);
    [order[index], order[other]] = [order[other], order[index]];
  }

  try {
    const recent = JSON.parse(localStorage.getItem('wz-recent') || '[]');
    const list = document.getElementById('news-recent');
    if (Array.isArray(recent)) {
      recent.filter(tool => tool && /^\/[a-z0-9-]+$/.test(tool.u) && typeof tool.n === 'string')
        .slice(0, 4).forEach(tool => {
          const link = document.createElement('a');
          link.href = tool.u;
          link.textContent = tool.n.slice(0, 80);
          list.append(link);
        });
    }
    if (!list.children.length) list.textContent = 'Open a tool and it will appear here next time.';
  } catch {
    document.getElementById('news-recent').textContent = 'Explore the catalog to find your next tool.';
  }

  const buttons = slides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Show announcement ' + (index + 1));
    button.onclick = () => { show(order.indexOf(index)); };
    dots.append(button);
    return button;
  });

  function show(position) {
    const previous = order[current];
    current = (position + order.length) % order.length;
    const selected = order[current];
    slides.forEach((slide, index) => { slide.hidden = index !== selected; });
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === selected));
    });
    document.getElementById('news-position').textContent = 'Announcement ' + (selected + 1) + ' of ' + slides.length;
    const active = slides[selected];
    if (previous !== selected && !reducedMotion.matches) {
      active.getAnimations().forEach(animation => animation.cancel());
      active.animate(
        [{ opacity: 0, transform: 'translateX(22px)' }, { opacity: 1, transform: 'translateX(0)' }],
        { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
    }
    carousel.classList.remove('news-ticking');
    if (!reducedMotion.matches) {
      void carousel.offsetWidth;
      carousel.classList.add('news-ticking');
    }
  }

  document.getElementById('news-prev').onclick = () => { show(current - 1); };
  document.getElementById('news-next').onclick = () => { show(current + 1); };
  let timer = setInterval(advance, 3600);
  function advance() {
    const focusedLink = slides[order[current]].contains(document.activeElement);
    if (!reducedMotion.matches && !focusedLink && !document.hidden && !document.getElementById('overview').hidden) show(current + 1);
  }
  // Give manual selections a full reading interval before the next slide.
  controls.addEventListener('click', () => {
    clearInterval(timer);
    timer = setInterval(advance, 3600);
  });
  controls.hidden = false;
  show(0);
})();
