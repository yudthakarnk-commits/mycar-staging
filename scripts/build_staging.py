#!/usr/bin/env python3
"""Build a safe MYCAR STAGING Pages artifact from the MYCAR develop source.
Only static assets are copied. No production auth-config, credentials, QA files,
or GitHub workflow files are published.
"""
import json
import os
import re
import shutil
from pathlib import Path

SOURCE = Path('source')
DEST = Path('site')
STAGING_URL = 'https://dlbshlvyhfwkorooxbnu.supabase.co'
PRODUCTION_URL = 'https://pteskuyswmwppswzegxp.supabase.co'

FILES = [
    'index.html', 'app.js', 'auth.js', 'cloud-sync.js',
    'tng-import.js', 'vehicle-photos.js',
    'service-worker.js', 'manifest.webmanifest', '.nojekyll',
    'assets/app.css', 'assets/auth.css', 'assets/car-photos.css',
    'assets/mobile-viewport-fix.css', 'assets/tng-import.css',
    'assets/toyota-corolla-cross-3q.webp',
    'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
]

key = os.environ.get('MYCAR_STAGING_PUBLISHABLE_KEY', '').strip()
if not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]{10,}', key):
    raise SystemExit('Expected a valid staging sb_publishable_ key in GitHub Actions secret.')
if not SOURCE.is_dir():
    raise SystemExit('Source checkout missing.')
if DEST.exists():
    shutil.rmtree(DEST)
for rel in FILES:
    source_file = SOURCE / rel
    if not source_file.is_file():
        raise SystemExit(f'Missing required source file: {rel}')
    dest_file = DEST / rel
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_file, dest_file)

# Override production browser configuration. The actual PUBLIC key is resolved
# only inside GitHub Actions. Browser-visible publishable keys are not secrets.
config = {
    'supabaseUrl': STAGING_URL,
    'supabasePublishableKey': key,
}
(DEST / 'auth-config.js').write_text('window.MYCAR_AUTH_CONFIG = '+json.dumps(config)+';\n', encoding='utf-8')

index_path = DEST / 'index.html'
html = index_path.read_text(encoding='utf-8')
needle = '<script src="./auth.js?v=3.4.2" defer></script>'
if html.count(needle) != 1:
    raise SystemExit('Unexpected MYCAR script order/version; review app before deploying.')
html = html.replace(needle, '<script src="./auth-config.js" defer></script>\n    '+needle)
# Source development currently references qa-mocks.js which is NOT in repository.
# Never publish a missing or test-only mocking script to staging.
html, num_removed = re.subn(r'<script\s+src="\./qa-mocks\.js"\s+defer></script>', '', html)
if num_removed > 1 or 'qa-mocks.js' in html:
    raise SystemExit('Unexpected QA mocking script reference(s).')
if '<head>' not in html or '</head>' not in html:
    raise SystemExit('Missing HTML head.')
# Visible watermark fixed above the bottom navigation (noninteractive).
watermark = ('<style id="mycar-staging-watermark">'
             'body::after{content:"STAGING • TEST DATA";'
             'position:fixed;right:10px;bottom:calc(77px + env(safe-area-inset-bottom, 0px));'
             'z-index:2147483000;pointer-events:none;'
             'background:#7c2d12;color:white;border-radius:6px;'
             'font:bold 10px system-ui;padding:5px 7px;letter-spacing:.4px;'
             'box-shadow:0 1px 5px #0005}'
             '</style>')
html = html.replace('</head>', '  '+watermark+'\n</head>', 1)
html = html.replace('<title>MYCAR — Vehicle Tracker</title>', '<title>MYCAR STAGING — Vehicle Tracker</title>', 1)
index_path.write_text(html, encoding='utf-8')

# Critical: GitHub Pages for mycar and mycar-staging are SAME ORIGIN.
# Original SW deletes every cache whose name begins "mycar-"; this would wipe
# production caches even though SW path scope differs. Make it staging-only.
sw_path = DEST / 'service-worker.js'
sw = sw_path.read_text(encoding='utf-8')
sw, n_cache = re.subn(r"const CACHE='[^']+';", "const CACHE='mycar-staging-shell-v1';", sw, count=1)
sw, n_filter = sw.replace("key.startsWith('mycar-')", "key.startsWith('mycar-staging-')"), sw.count("key.startsWith('mycar-')")
if n_cache != 1 or n_filter != 1:
    raise SystemExit('Service worker cache isolation pattern changed; review manually.')
sw_path.write_text(sw, encoding='utf-8')

manifest_path = DEST / 'manifest.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['name'] = 'MYCAR STAGING — Test Only'
manifest['short_name'] = 'MYCAR TEST'
manifest['description'] = 'Staging environment. Never use for real vehicle data.'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

# Fail closed on production URL accidentally copied into published JS/HTML/CSS.
for p in DEST.rglob('*'):
    if p.is_file() and p.suffix.lower() in ('.js', '.html', '.css', '.webmanifest'):
        content = p.read_text(encoding='utf-8')
        if PRODUCTION_URL in content:
            raise SystemExit(f'PRODUCTION URL found in publish artifact: {p}')
        if re.search(r'sb_secret_[A-Za-z0-9_-]{10,}', content):
            raise SystemExit(f'Privileged API key found in publish artifact: {p}')
assert (DEST / 'auth-config.js').is_file()
assert STAGING_URL in (DEST / 'auth-config.js').read_text(encoding='utf-8')
assert 'mycar-staging-' in sw
assert 'mycar-staging-' in sw
print(f'STAGING BUILD VERIFIED: {len(FILES)+1} published files; isolated cache; staging auth config; no production URL.')
