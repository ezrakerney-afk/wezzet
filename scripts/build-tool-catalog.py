"""Rebuild the homepage inventory from search, public tool pages and calculators."""
import json, re
from html import escape
from urllib.parse import urlencode
from pathlib import Path
root = Path(__file__).resolve().parents[1]
source = (root / 'assets/home.js').read_text()
rows = json.loads('[' + source.split('const TOOLS = [', 1)[1].split('].map', 1)[0].rstrip().rstrip(',') + ']')
entries = {url: {'url': url, 'name': name} for name, url, _ in rows}
excluded = {'index', '404', 'about', 'contact', 'privacy', 'signin'}
for page in sorted(root.glob('*.html')):
    if page.stem in excluded: continue
    url = '/' + page.stem
    title = re.search(r'<title>(.*?)</title>', page.read_text(), re.S).group(1).split('|')[0].strip()
    entries.setdefault(url, {'url': url, 'name': title})
# A collection is not an extra calculator: count its twelve selectable tools individually.
calculators = re.findall(r"^ \['([^']+)'", (root / 'assets/calculators.js').read_text(), re.M)
features = [{'url': '/calculators', 'name': name} for name in calculators]
count = len(entries) - 1 + len(features)
catalog = {'count': count, 'pages': list(entries.values()), 'calculatorFeatures': features,
           'countingNote': 'Every public tool and feature destination, with the 12 everyday calculators counted individually. Repeated links, account and information pages are excluded.'}
(root / 'assets/tool-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
index = root / 'index.html'
html = re.sub(r'(<strong id="feature-count">).*?(</strong>)', lambda m: m[1] + str(count) + m[2], index.read_text())
links = [(entry['name'], entry['url']) for entry in entries.values() if entry['url'] != '/calculators']
links.extend((name, '/calculators?' + urlencode({'calc': name})) for name in calculators)
items = '\n'.join(
    f'          <li><a href="{escape(url, quote=True)}">{escape(name)}</a></li>'
    for name, url in sorted(links, key=lambda link: (link[0].casefold(), link[1]))
)
html = re.sub(
    r'(<!-- tool-catalog:start -->).*?(<!-- tool-catalog:end -->)',
    lambda match: match[1] + '\n' + items + '\n          ' + match[2],
    html,
    flags=re.S,
)
index.write_text(html)
print(f'{count} tools and features across {len(entries)} destinations')
