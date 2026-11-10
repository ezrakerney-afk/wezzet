/* Aggregate rankings only: no visitor identifiers or uploaded content. */
(async () => {
  const status = document.getElementById('popular-status');
  try {
    const response = await fetch('/api/tool-stats');
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (Number.isInteger(data.count)) document.getElementById('feature-count').textContent = data.count.toLocaleString();
    const list = document.getElementById('popular-tools');
    list.replaceChildren();
    data.top.forEach((tool, i) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = tool.url;
      const rank = document.createElement('span');
      rank.className = 'popular-rank'; rank.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('strong'); name.textContent = tool.name;
      const count = document.createElement('span'); count.className = 'popular-visits';
      count.textContent = tool.visits.toLocaleString() + (tool.visits === 1 ? ' visit' : ' visits');
      link.append(rank, name, count); li.append(link); list.append(li);
    });
    status.hidden = data.top.length >= 5;
    status.textContent = data.top.length ? 'More tools will appear as they receive visits.' : 'The ranking starts with real visits. Your community’s favorites will appear here soon.';
  } catch {
    status.textContent = 'Rankings are temporarily unavailable. Please try again later.';
  }
})();
