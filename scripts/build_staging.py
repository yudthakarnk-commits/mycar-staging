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
    'sync-health.js', 'backup-preview.js',
    'restore-dry-run.js',
    'pre-restore-snapshot.js',
    'snapshot-download.js',
    'tng-import.js', 'vehicle-photos.js',
    'service-worker.js', 'manifest.webmanifest', '.nojekyll',
    'assets/app.css', 'assets/auth.css', 'assets/car-photos.css',
    'assets/mobile-viewport-fix.css', 'assets/tng-import.css',
    'assets/sync-health.css', 'assets/backup-preview.css',
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

# STAGING-owned app files take precedence over upstream develop.
# Previous build always published develop/cloud-sync.js and develop/index.html,
# silently discarding tested staging-only RPC, diagnostics and conflict work.
# Keep upstream-only binary assets and auxiliary scripts via FILES above.
STAGING_OVERRIDES = [
    'index.html', 'app.js', 'auth.js', 'cloud-sync.js',
    'sync-health.js', 'backup-preview.js', 'restore-dry-run.js',
    'receipt-guard.js', 'receipt-integrated-ui.js', 'rpc-restore-staging.js', 'tng-import.js', 'vehicle-photos.js', 'service-worker.js',
    'manifest.webmanifest', 'assets/app.css', 'assets/auth.css',
    'assets/car-photos.css', 'assets/mobile-viewport-fix.css',
    'assets/tng-import.css', 'assets/sync-health.css',
    'assets/backup-preview.css'
]
for rel in STAGING_OVERRIDES:
    override = Path(rel)
    if not override.is_file():
        raise SystemExit(f'Missing staging override: {rel}')
    shutil.copy2(override, DEST / rel)

# Ensure staging-specific icon paths referenced by staged index and manifest exist.
icon = Path('icons/staging.svg')
if not icon.is_file():
    raise SystemExit('Missing staging icon icons/staging.svg')
shutil.copy2(icon, DEST / 'icons/staging.svg')

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
config_tag = '<script src="./auth-config.js" defer></script>'
if config_tag not in html:
    html = html.replace(needle, config_tag + '\n    ' + needle)

if html.count(config_tag) != 1:
    raise SystemExit('Expected exactly one auth-config.js script.')
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
# The current staging service worker already has an isolated cache name
# and filter; never rewrite it using production assumptions.
if "const CACHE='mycar-staging-" not in sw:
    raise SystemExit('Expected a staging-only service worker CACHE')
if "key.startsWith('mycar-staging-')" not in sw and "k.startsWith('mycar-staging-')" not in sw:
    raise SystemExit('Expected staging-only cache cleanup')
if "key.startsWith('mycar-shell-')" in sw or "key.startsWith('mycar-')" in sw:
    raise SystemExit('Service worker has a non-staging cache cleanup')
sw_path.write_text(sw, encoding='utf-8')

manifest_path = DEST / 'manifest.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['name'] = 'MYCAR STAGING — Test Only'
manifest['short_name'] = 'MYCAR TEST'
manifest['description'] = 'Staging environment. Never use for real vehicle data.'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

# Publish isolated, database-free receipt device QA only after verifying pinned assets.
import hashlib
qa = Path('receipt-qa')
qa_files = ['index.html', 'qa.js', 'service-worker.js', 'manifest.webmanifest',
            'fuel-receipt.js', 'fuel-receipt-ui.js', 'vendor/ocr/SHA256SUMS']
for line in (qa / 'vendor/ocr/SHA256SUMS').read_text(encoding='utf-8').splitlines():
    digest, rel = line.split(maxsplit=1)
    rel = rel.removeprefix('./')
    assert not Path(rel).is_absolute() and '..' not in Path(rel).parts
    path = qa / 'vendor/ocr' / rel
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, f'OCR checksum mismatch: {rel}'
    qa_files.append('vendor/ocr/' + rel)
for rel in qa_files:
    target = DEST / 'receipt-qa' / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(qa / rel, target)
assert 'NO DATABASE' in (DEST / 'receipt-qa/index.html').read_text(encoding='utf-8')
print(f'RECEIPT DEVICE QA VERIFIED: {len(qa_files)} files')

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
published_index = (DEST / 'index.html').read_text(encoding='utf-8')
published_sync = (DEST / 'cloud-sync.js').read_text(encoding='utf-8')
assert 'Build 2026-11-24.2' in published_index, 'Staging build identifier missing'
assert 'Open Sync Diagnostics' in published_index, 'Staging diagnostic button missing'
assert 'mycar_apply_changes' in published_sync, 'Staging RPC sync missing'
assert 'function diagnostics()' in published_sync, 'Staging diagnostic API missing'
assert 'armLostAckTest' in published_sync and 'qaLostAckResult' in published_sync, 'Timeout QA controls missing'
assert 'Arm One-Time Lost-Ack Test' in published_index, 'Timeout QA UI missing'
assert 'armBeforeCommitTest' in published_sync and 'qaBeforeCommitResult' in published_sync, 'Before-dispatch QA controls missing'
assert 'readbackMatches' in published_sync and 'valueChanged' in published_sync, 'Fault-test readback verification missing'
assert 'Arm One-Time Before-Dispatch Test' in published_index, 'Before-dispatch QA UI missing'
assert 'exclusiveRestore' in published_sync, 'Restore maintenance lock missing'
assert 'rpc-restore-staging.js' in published_index, 'Restore UI script missing'
assert 'mycar-rpc-restore' in published_index, 'Restore UI missing'
assert (DEST / 'rpc-restore-staging.js').is_file(), 'RPC Restore module missing'
published_restore = (DEST / 'rpc-restore-staging.js').read_text(encoding='utf-8')
assert 'mycar_restore_preview' in published_restore
assert 'mycar_restore_merge' in published_restore
assert 'mycar_reverse_restore' in published_restore
assert 'refreshReverseButton' in published_restore
assert 'https://pteskuyswmwppswzegxp.supabase.co' not in published_restore
assert 'resolution=merge-duplicates' not in published_sync, 'Legacy direct write forbidden'
assert 'https://pteskuyswmwppswzegxp.supabase.co' not in published_sync
print(f'STAGING BUILD VERIFIED: {len(FILES)+2} published files; staging RPC client; diagnostics; isolated cache; staging auth config; no production URL.')
