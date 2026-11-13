(() => {
  const carousel = document.getElementById('website-news');
  const slides = [...carousel.querySelectorAll('.news-slide')];
  const dots = carousel.querySelector('.news-dots');
  const controls = carousel.querySelector('.news-controls');
  const position = document.getElementById('news-position');
  const pause = document.getElementById('news-pause');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let current = 0;
  let timer;

  const buttons = slides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Show ' + slide.querySelector('.news-topic').textContent);
    button.addEventListener('click', () => select(index));
    dots.append(button);
    return button;
  });

  function show(index, announce = false) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== current; });
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    position.textContent = announce
      ? `Announcement ${current + 1} of ${slides.length}: ${slides[current].querySelector('h2').textContent}`
      : '';
  }

  function setPaused(value) {
    paused = value;
    clearInterval(timer);
    pause.textContent = paused ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    if (!paused) {
      timer = setInterval(() => {
        if (!document.hidden && !carousel.closest('[hidden]') &&
            !carousel.matches(':hover, :focus-within')) {
          show(current + 1);
        }
      }, 5500);
    }
  }

  function select(index) {
    setPaused(true);
    show(index, true);
  }

  pause.addEventListener('click', () => setPaused(!paused));
  document.getElementById('news-prev').addEventListener('click', () => select(current - 1));
  document.getElementById('news-next').addEventListener('click', () => select(current + 1));
  motion.addEventListener('change', event => {
    if (event.matches) setPaused(true);
  });
  show(0);
  setPaused(paused);
  controls.hidden = false;
})();
