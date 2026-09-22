#!/usr/bin/env python3
"""Insert the settings-i18n keys into shared/src/translations.ts.

Strategy: locate the closing `});` of the main `Object.assign(d, { ... })`
call (the first one in the file) and insert the settings keys immediately
before it. Idempotent — running twice is a no-op.
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(ROOT, "shared", "src", "translations.ts")

# Settings keys — UTF-8 (Python source) to avoid any encoding gymnastics.
KEYS = [
    "  // --- Settings screen (language picker) ---",
    "  'settings.title': T('Set\u0103ri', 'Settings'),",
    "  'settings.section_title': T('Limb\u0103 aplica\u021bie', 'App language'),",
    "  'settings.section_subtitle': T(",
    "    'Alege limba \u00een care sunt afi\u0219ate tutorialele, ajutoarele \u0219i textul OCR.',",
    "    'Choose the language used for tutorials, help and OCR text.',",
    "  ),",
    "  'settings.option.ro.label': T('Rom\u00e2n\u0103', 'Romanian'),",
    "  'settings.option.ro.sub': T('Rom\u00e2n\u0103', 'Romanian'),",
    "  'settings.option.en.label': T('English', 'English'),",
    "  'settings.option.en.sub': T('English', 'English'),",
    "  'settings.saved_hint': T(",
    "    'Setarea este salvat\u0103 automat pe acest dispozitiv.',",
    "    'This setting is saved automatically on this device.',",
    "  ),",
    "  'settings.ar_label': T('Limb\u0103', 'Language'),",
    "  'settings.tab_label': T('Set\u0103ri', 'Settings'),",
]

with open(TARGET, "r", encoding="utf-8") as f:
    text = f.read()

# Idempotency.
if "'settings.title'" in text:
    print("settings keys already present; nothing to do")
    sys.exit(0)

# Find the first `});` after an `Object.assign(d, {` opener.
# The block starts at "Object.assign(d, {" and the matching closing `});`
# sits on its own line.
start = text.find("Object.assign(d, {")
if start == -1:
    print("Could not locate Object.assign(d, { opener; aborting", file=sys.stderr)
    sys.exit(1)
close = text.find("});", start)
if close == -1:
    print("Could not locate matching `});`; aborting", file=sys.stderr)
    sys.exit(1)

# Insert the keys right before `});`, keep exact same indentation as siblings
# (two-space indent because the surrounding block uses 2 spaces).
before = text[:close]
after = text[close:]
insert = "\n".join(KEYS) + "\n"
new = before + insert + after

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(new)

print("OK — inserted", len(KEYS), "lines")
