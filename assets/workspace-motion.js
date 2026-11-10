(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let cleanup = () => {};

  function playEntrance() {
    cleanup();
    let overlay = document.querySelector('.workspace-intro');
    const destination = document.querySelector('.brand img');
    if (!destination) {
      overlay?.remove();
      return;
    }
    if (preference.matches) {
      overlay?.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'workspace-intro';
      overlay.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.src = '/assets/icon-512.png';
      image.alt = '';
      image.className = 'intro-wz';
      overlay.append(image);
      document.body.prepend(overlay);
    }
    const logo = overlay.querySelector('.intro-wz');
    const size = Math.min(190, innerWidth * 0.36);
    const startX = (innerWidth - size) / 2;
    const startY = (innerHeight - size) / 2;
    const target = destination.getBoundingClientRect();
    Object.assign(logo.style, {
      width: size + 'px', height: size + 'px',
      left: startX + 'px', top: startY + 'px',
      transform: 'none',
    });
    destination.style.visibility = 'hidden';
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      destination.style.removeProperty('visibility');
      overlay.remove();
    }
    cleanup = finish;
    // Always release the overlay, including on cancellation or unsupported animation APIs.
    const fallback = setTimeout(finish, 1800);
    try {
      logo.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 0, offset: 0 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.18 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.3 },
        { transform: `translate(${target.left - startX}px, ${target.top - startY}px) scale(${target.width / size})`, opacity: 1 },
      ], { duration: 1050, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
      const reveal = overlay.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { delay: 1000, duration: 350, easing: 'ease-out', fill: 'forwards' },
      );
      reveal.finished.then(() => { clearTimeout(fallback); finish(); }).catch(finish);
    } catch {
      clearTimeout(fallback);
      finish();
    }
  }

  playEntrance();
  addEventListener('pageshow', event => {
    if (event.persisted) playEntrance();
  });
  addEventListener('pagehide', () => cleanup());
  preference.addEventListener('change', event => {
    if (event.matches) cleanup();
  });
})();
