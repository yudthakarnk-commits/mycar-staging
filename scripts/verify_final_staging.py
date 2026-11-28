"""Check the entire final staging publish directory, including added OCR bundles."""
import json
import re
from pathlib import Path
root = Path('site')
prod = 'https://pteskuyswmwppswzegxp.supabase.co'
for p in root.rglob('*'):
    if p.is_file() and p.suffix.lower() in ('.js', '.mjs', '.html', '.css', '.json', '.webmanifest'):
        s = p.read_text(encoding='utf-8')
        assert prod not in s, f'Production URL in {p}'
        assert not re.search(r'sb_secret_[A-Za-z0-9_-]{10,}', s), f'Privileged API key in {p}'
for path, prefix in [('paddle-device-qa','mycar-paddle-device-qa:'),('paddle-integrated','mycar-paddle-integrated:')]:
    folder = root / path
    m = json.loads((folder / 'offline-manifest.json').read_text())
    assert m['cache'].startswith(prefix)
    assert m['files'] and len(m['files']) == len(set(m['files']))
    assert 'index.html' in m['files'] and 'offline-manifest.json' in m['files']
    for name in m['files']:
        p = Path(name)
        assert not p.is_absolute() and '..' not in p.parts
        assert (folder / p).is_file(), f'Missing precache asset: {path}/{name}'
    assert len([n for n in m['files'] if n.startswith('models/') and n.endswith('.tar')]) == 2
    assert (folder / 'service-worker.js').is_file()
assert 'Security 1' in (root / 'index.html').read_text()
print('Final staging artifact verification passed: production URL and privileged-key scan, isolated OCR manifests and asset presence.')
