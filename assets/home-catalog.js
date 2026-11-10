(() => {
  const filter = document.getElementById('catalog-filter');
  const status = document.getElementById('catalog-status');
  const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const tools = [...document.querySelectorAll('#catalog-list li')].map(item => ({
    item,
    search: normalize(item.textContent + ' ' + item.firstElementChild.pathname),
  }));

  function update() {
    const terms = normalize(filter.value).split(' ').filter(Boolean);
    let visible = 0;
    for (const { item, search } of tools) {
      const matches = terms.every(term => search.includes(term));
      item.hidden = !matches;
      if (matches) visible++;
    }
    status.textContent = visible === 0 ? 'No matching tools. Try another search.'
      : terms.length ? `${visible} of ${tools.length} tools` : `${tools.length} tools, A–Z`;
  }

  filter.addEventListener('input', update);
  document.getElementById('catalog-controls').hidden = false;
  update();
})();
