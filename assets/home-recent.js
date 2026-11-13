(() => {
  try {
    const recent = JSON.parse(localStorage.getItem('wz-recent') || '[]');
    if (!Array.isArray(recent)) return;

    const list = document.getElementById('recent-tools');
    for (const tool of recent.filter(tool => tool && typeof tool.u === 'string'
      && /^\/[a-z0-9-]+$/.test(tool.u) && typeof tool.n === 'string' && tool.n.trim()).slice(0, 4)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = tool.u;
      link.textContent = tool.n.slice(0, 80);
      item.append(link);
      list.append(item);
    }
    document.getElementById('home-recent').hidden = !list.children.length;
  } catch {
    // The rest of the homepage remains available when local storage is blocked.
  }
})();
