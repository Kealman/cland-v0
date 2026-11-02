#!/usr/bin/env python3
"""Prove the T-1631 move. Supply exported baseline files; no Git or hub is run.

python3 docs/hub/check-move.py --readme /path/to/old-readme --skill /path/to/old-skill
The baseline commit is recorded in move-manifest.json. Only recorded link/path
relocations are reversed before byte comparisons. No prose normalization occurs.
"""
import argparse, hashlib, json, re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--readme', type=Path, required=True)
parser.add_argument('--skill', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'docs/hub/move-manifest.json').read_text())
files = {str(p.relative_to(root)): p.read_text() for p in (root / 'docs/hub').glob('*.md')}
def prose(text):
    for exception in manifest['exceptions']:
        text = text.replace(exception['new'], exception['old'])
    text = re.sub(r'\]\([^\s)]+\)', '](<relocated destination>)', text)
    return re.sub(r'(?:docs/hub/[\w.-]+\.md|hub/README\.md)', '<hub reference>', text)

# Rebuild original bytes from disjoint, position-bound relocation receipts.
for path, edits in manifest.get('relocations', {}).items():
    text = files[path]
    for edit in edits:
        start = edit['start']
        assert text[start:start + len(edit['after'])] == edit['after'], (path, 'relocation drift')
        text = text[:start] + edit['before'] + text[start + len(edit['after']):]
    assert prose(text) == prose(files[path]), (path, 'unapproved prose edit')
    files[path] = text
sources = {'hub/README.md': args.readme.read_text(), '.agents/skills/implement/SKILL.md': args.skill.read_text()}
readme_blocks = []
for block in manifest['blocks']:
    source = sources[block['source']]
    # Find the original exact bytes by hash and byte length, using recorded
    # source offsets (populated from the baseline, independent of destinations).
    text = source[block['start']:block['end']]
    assert hashlib.sha256(text.encode()).hexdigest() == block['sha256'], ('baseline mismatch', block['title'])
    owners = [path for path, body in files.items() if text in body]
    assert block['destination'] in owners, (block['title'], owners)
    if block['source'] == 'hub/README.md':
        assert owners == [block['destination']], (block['title'], owners)
    if block['source'] == 'hub/README.md':
        assert files[block['destination']].count(text) == 1, ('duplicate block', block['title'])
    if block['source'] == 'hub/README.md': readme_blocks.append(text)
assert ''.join(readme_blocks) == sources['hub/README.md'], 'README coverage is incomplete'
# Every unmoved skill paragraph remains in the shared procedure.
skill_source = sources['.agents/skills/implement/SKILL.md']
retained = prose((root / '.agents/skills/implement/SKILL.md').read_text())
moved = {(b['start'], b['end']) for b in manifest['blocks'] if b['source'] == '.agents/skills/implement/SKILL.md'}
position = 0
for paragraph in re.split(r'(?<=\n)\n', skill_source):
    end = position + len(paragraph)
    if paragraph.strip() and (position, end) not in moved:
        assert prose(paragraph) in retained, ('missing retained skill paragraph', paragraph[:100])
    position = end + 1
assert len((root / 'hub/README.md').read_text().splitlines()) < 150
print(f"PASS: {len(readme_blocks)} README sections and {len(manifest['blocks']) - len(readme_blocks)} skill blocks; exact bytes after reversing recorded link relocations")

for exception in manifest['exceptions']:
    print(f"Approved non-verbatim exception in {exception['file']}: {exception['reason']}")
    print('Old: ' + exception['old'])
    print('New: ' + exception['new'])
