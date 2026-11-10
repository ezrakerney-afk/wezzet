(() => {
  const carousel = document.getElementById('website-news');
  const slides = [...carousel.querySelectorAll('.news-slide')];
  const controls = carousel.querySelector('.news-controls');
  const dots = carousel.querySelector('.news-dots');
  const pauseButton = document.getElementById('news-pause');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  let current = 0;
  let hovered = false;

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
    button.onclick = () => { paused = true; show(order.indexOf(index)); };
    dots.append(button);
    return button;
  });

  function show(position) {
    current = (position + order.length) % order.length;
    const selected = order[current];
    slides.forEach((slide, index) => { slide.hidden = index !== selected; });
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === selected));
    });
    document.getElementById('news-position').textContent = 'Announcement ' + (selected + 1) + ' of ' + slides.length;
    pauseButton.textContent = paused ? '▶' : 'Ⅱ';
    pauseButton.setAttribute('aria-label', paused ? 'Play announcements' : 'Pause announcements');
  }

  document.getElementById('news-prev').onclick = () => { paused = true; show(current - 1); };
  document.getElementById('news-next').onclick = () => { paused = true; show(current + 1); };
  pauseButton.onclick = () => { paused = !paused; show(current); };
  carousel.addEventListener('mouseenter', () => { hovered = true; });
  carousel.addEventListener('mouseleave', () => { hovered = false; });
  carousel.addEventListener('focusin', () => { paused = true; show(current); });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { paused = true; show(current); }
  });
  setInterval(() => {
    if (!paused && !hovered && !document.hidden && !document.getElementById('overview').hidden) show(current + 1);
  }, 7000);
  controls.hidden = false;
  show(0);
})();
