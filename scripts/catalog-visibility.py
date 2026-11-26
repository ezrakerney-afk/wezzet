"""Keep individual numeric conversions out of the homepage directory only."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Retain general-purpose hubs and code/text utilities.
KEEP = {'/units', '/number', '/ohms-law', '/ascii-converter', '/gray-code', '/bcd-converter', '/twos-complement'}

def is_basic_converter(url):
    path = url.split('?', 1)[0]
    if path in KEEP or path.startswith(('/text-to-', '/ascii-to-')):
        return False
    page = ROOT / (path.lstrip('/') + '.html')
    return page.exists() and bool(re.search(r'/assets/(?:units|number|electric)\.js(?:[?"\s])', page.read_text()))
