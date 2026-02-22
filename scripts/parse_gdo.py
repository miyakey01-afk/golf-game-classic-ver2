#!/usr/bin/env python3
"""Parse scraped GDO course data text files into courses.json format.

Handles multiple table formats:
  - Hole|Par|HDCP|Yardage(s)  - HDCP in 3rd column
  - Hole|Par|Yardage(s)|HDCP  - HDCP in last column
  - HDCP may be "—" or "-" (treated as 0)
  - Multiple yardage columns (takes the first/longest tee)
"""
import json
import re
import os
import sys


def get_prefecture_for_id(gdo_id):
    """Determine prefecture from GDO course ID prefix."""
    if gdo_id.startswith('35'):
        return '千葉県'
    elif gdo_id.startswith('37'):
        return '神奈川県'
    elif gdo_id.startswith('13'):
        return '東京都'
    return '千葉県'  # default fallback


# Section headers to skip (course overview, summary sections)
_SKIP_SECTION_RE = re.compile(
    r'overview|course rate|layout|designer|key detail|course detail|course info|characteristics',
    re.IGNORECASE
)

# Yardage column keyword patterns
_YARD_COL_RE = re.compile(
    r'yard|yardage|black|blue|white|red|back|reg|regular|front|champion|ladies|lad|gold|green|'
    r'silver|orange|bent|korai|pink|bt|b\.t\.|bm|b\.m\.|yd|\(yd\)',
    re.IGNORECASE
)


def _detect_columns(header_line):
    """Parse table header row to detect HDCP and first-yardage column indices.

    Returns dict with 'hdcp' and 'yardage' keys (column indices, 0-based after
    splitting by '|' and stripping outer pipes).
    """
    parts = [p.strip().lower() for p in header_line.strip().strip('|').split('|')]
    col = {}
    for i, p in enumerate(parts):
        if i < 2:  # skip hole(0) and par(1) columns
            continue
        if re.search(r'hdcp|hcp|handicap', p) and 'hdcp' not in col:
            col['hdcp'] = i
        elif _YARD_COL_RE.search(p) and 'yardage' not in col:
            col['yardage'] = i
    return col


def _parse_int(s):
    """Strip non-digit chars and parse int; return None if empty."""
    clean = re.sub(r'[^\d]', '', s)
    return int(clean) if clean else None


# ── Name cleanup ──────────────────────────────────────────────────────────────
_NAME_CLEAN_RES = [
    re.compile(r'^(?:Golf Course Data|Course Name):\s*', re.IGNORECASE),  # leading prefix
    re.compile(r'\s*[-–]\s*(?:ホール別データ|Course Data|Hole-by-Hole Data|Hole by Hole Data)', re.IGNORECASE),  # dash suffix
    re.compile(r'\s+Course Data\s*$', re.IGNORECASE),             # trailing without dash
]

def clean_course_name(name):
    """Remove metadata suffixes/prefixes from course names."""
    for pattern in _NAME_CLEAN_RES:
        name = pattern.sub('', name)
    return name.strip()


# ── 50-on sort key ─────────────────────────────────────────────────────────────
def _sort_key(course):
    """Sort key for 50-on (Japanese syllabary) order.

    Converts full-width katakana → hiragana so both sort identically.
    """
    name = course.get('name', '')
    chars = []
    for ch in name:
        code = ord(ch)
        # Full-width katakana (ァ-ヶ) → hiragana by subtracting 0x60
        if 0x30A1 <= code <= 0x30F6:
            chars.append(chr(code - 0x60))
        else:
            chars.append(ch)
    return ''.join(chars)


def parse_course_text(text, gdo_id, fallback_name, prefecture='千葉県'):
    """Parse the text output from WebFetch for a single course."""
    lines = text.strip().split('\n')

    # Extract course name from the first 10 lines
    course_name = fallback_name
    for line in lines[:10]:
        cleaned = line.strip().strip('#').strip()
        cleaned = re.sub(r'\s*[-–]\s*Hole.*$', '', cleaned).strip()
        cleaned = re.sub(r'\*\*.*?\*\*\s*', '', cleaned).strip()
        if cleaned and any(kw in cleaned for kw in ['コース', 'ゴルフ', 'カントリー', '倶楽部', 'クラブ', 'カンツリー']):
            course_name = cleaned.split('|')[0].strip().strip('#').strip()
            course_name = clean_course_name(course_name.replace('**', '').strip())
            break

    # hole_data: {label: {hole_num: {par, hdcp, yardage}}}
    hole_data = {}
    current_section = None
    is_in_section = False   # True when section name contains "IN"
    col = {}                # detected column positions from table header

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # ── Section header detection ──────────────────────────────────────────
        # Match any Markdown heading (# to ####)
        hdr = re.match(r'^#{1,4}\s+(.+?)$', line)
        if hdr:
            raw = hdr.group(1).strip()
            # Skip "overview", "course detail" etc. sections
            if _SKIP_SECTION_RE.search(raw):
                current_section = None
                col = {}
                continue
            current_section = raw
            col = {}  # reset column detection for each section
            is_in_section = bool(re.search(r'\bIN\b', current_section, re.IGNORECASE))
            continue

        # Also detect bold **OUT** / **IN** as section markers
        bold_hdr = re.match(r'^\*\*\s*(.*?(?:OUT|IN).*?)\s*\*\*\s*$', line, re.IGNORECASE)
        if bold_hdr:
            current_section = bold_hdr.group(1).strip()
            col = {}
            is_in_section = bool(re.search(r'\bIN\b', current_section, re.IGNORECASE))
            continue

        if not current_section:
            continue

        # ── Table header row ─────────────────────────────────────────────────
        if re.match(r'\|\s*(?:HOLE|Hole|H\.)\s*\|', line, re.IGNORECASE):
            col = _detect_columns(line)
            continue

        # ── Separator rows ────────────────────────────────────────────────────
        if re.match(r'\|[\s\-:]+\|', line):
            continue

        # ── Data rows ─────────────────────────────────────────────────────────
        if '|' not in line:
            continue

        parts = [p.strip() for p in line.strip().strip('|').split('|')]
        if len(parts) < 4:
            continue

        # Hole number (1–18)
        hole_num = _parse_int(parts[0])
        if hole_num is None or not 1 <= hole_num <= 18:
            continue

        # Par (3, 4, or 5)
        par = _parse_int(parts[1])
        if par not in (3, 4, 5):
            continue

        # HDCP and Yardage ─────────────────────────────────────────────────────
        hdcp = 0
        yardage = 0

        if 'hdcp' in col and 'yardage' in col:
            # Use detected column positions
            if col['hdcp'] < len(parts):
                v = _parse_int(parts[col['hdcp']])
                hdcp = v if v is not None else 0
            if col['yardage'] < len(parts):
                v = _parse_int(parts[col['yardage']])
                yardage = v if v is not None else 0
        else:
            # Auto-detect: HDCP is 1–18, yardage is ≥50
            # Scan remaining cells in order
            for val in parts[2:]:
                num = _parse_int(val)
                if num is None:
                    continue
                if 1 <= num <= 18 and hdcp == 0:
                    hdcp = num
                elif num >= 50 and yardage == 0:
                    yardage = num

        # ── Section label ─────────────────────────────────────────────────────
        section_clean = re.sub(r'\(.*?\)', '', current_section).strip()
        label = _extract_label(section_clean)

        # ── Hole renumbering ──────────────────────────────────────────────────
        # Case 1: Explicit IN section with holes 1–9 → make them 10–18
        if is_in_section and hole_num <= 9:
            hole_num += 9

        # Case 2: Second batch of holes 1–9 under the same label
        #   (e.g. two named 9-hole sections: 長浦+蔵波 each numbered 1–9)
        elif hole_num <= 9 and label in hole_data:
            existing = hole_data[label]
            if (sum(1 for h in existing if h <= 9) >= 9
                    and not any(h > 9 for h in existing)):
                hole_num += 9

        if label not in hole_data:
            hole_data[label] = {}
        hole_data[label][hole_num] = {'par': par, 'hdcp': hdcp, 'yardage': yardage}

    # ── Build course entries ──────────────────────────────────────────────────
    courses = []
    for label, holes in hole_data.items():
        if len(holes) < 9:
            continue

        name_suffix = f' {label}コース' if label else ''
        full_name = course_name + name_suffix if label else course_name

        course_id = f"gdo_{gdo_id}"
        if label:
            label_romaji = LABEL_ROMAJI.get(label, label.lower())
            course_id += f'_{label_romaji}'

        total_par = sum(h['par'] for h in holes.values())

        holes_arr = [
            {'hole': h_num, 'par': h['par'], 'hdcp': h['hdcp'], 'yardage': h.get('yardage', 0)}
            for h_num in sorted(holes.keys())
            for h in [holes[h_num]]
        ]

        courses.append({
            'id': course_id,
            'name': full_name,
            'prefecture': prefecture,
            'totalPar': total_par,
            'holes': holes_arr
        })

    return courses


# Label detection and romanization
LABEL_ROMAJI = {
    '東': 'east', '西': 'west', '南': 'south', '北': 'north', '中': 'center',
    'キング': 'king', 'クイーン': 'queen', '花葉': 'hanaha', '本': 'main',
    'A': 'a', 'B': 'b',
    'さくら': 'sakura', 'SAKURA': 'sakura',
    'かえで': 'kaede', 'KAEDE': 'kaede',
    'まつ': 'matsu', 'MATSU': 'matsu',
    'つつじ': 'tsutsuji', 'さつき': 'satsuki',
    'Cherry': 'sakura', 'Maple': 'kaede', 'Pine': 'matsu',
    'EAST': 'east', 'WEST': 'west', 'SOUTH': 'south', 'NORTH': 'north',
}

def _extract_label(section):
    """Extract course sub-label from section header text."""
    # Check Japanese direction prefixes
    for prefix in ['東', '西', '南', '北', '中']:
        if prefix in section:
            return prefix
    # Check named courses (Japanese)
    for named in ['キング', 'クイーン', '花葉', '本', 'さくら', 'かえで', 'まつ', 'つつじ', 'さつき']:
        if named in section:
            return named
    # Check named courses (English)
    section_upper = section.upper()
    for named in ['SAKURA', 'CHERRY', 'KAEDE', 'MAPLE', 'MATSU', 'PINE', 'KING', 'QUEEN']:
        if named in section_upper:
            eng_to_label = {
                'SAKURA': 'SAKURA', 'CHERRY': 'Cherry',
                'KAEDE': 'KAEDE', 'MAPLE': 'Maple',
                'MATSU': 'MATSU', 'PINE': 'Pine',
                'KING': 'キング', 'QUEEN': 'クイーン',
            }
            return eng_to_label.get(named, named)
    # Check English directions
    for d in ['EAST', 'WEST', 'SOUTH', 'NORTH']:
        if d in section_upper:
            return d
    # Check single letter labels
    for letter in ['A', 'B']:
        if re.search(rf'\b{letter}\b', section):
            return letter
    return ''


def merge_results(scripts_dir, output_file):
    """Merge all scraped course files into a single JSON."""
    all_courses = []
    scraped_dir = os.path.join(scripts_dir, 'scraped')

    # Load existing courses (the original hand-curated ones)
    existing_file = os.path.join(os.path.dirname(scripts_dir), 'data', 'courses.json')
    if os.path.exists(existing_file):
        with open(existing_file, 'r', encoding='utf-8') as f:
            all_courses = json.load(f)

    # Load course ID mapping from all available prefecture files
    id_map = {}
    for ids_filename in ['chiba_course_ids.json', 'kanagawa_course_ids.json']:
        ids_file = os.path.join(scripts_dir, ids_filename)
        if os.path.exists(ids_file):
            with open(ids_file, 'r', encoding='utf-8') as f:
                course_ids = json.load(f)
            id_map.update({c['id']: c['name'] for c in course_ids})

    # Fix any existing GDO courses: clean names, fix fallback names, fix prefecture
    for course in all_courses:
        course['name'] = clean_course_name(course['name'])
        if course['id'].startswith('gdo_'):
            raw_id = course['id'].replace('gdo_', '').split('_')[0]
            # Replace fallback names like "コース XXXXXX" with proper name from id_map
            if re.match(r'^コース \d+', course['name']) and raw_id in id_map:
                course['name'] = id_map[raw_id]
            correct_pref = get_prefecture_for_id(raw_id)
            if course.get('prefecture') != correct_pref:
                course['prefecture'] = correct_pref

    # Parse each scraped file
    existing_ids = {c['id'] for c in all_courses}
    added = 0
    skipped = 0

    for filename in sorted(os.listdir(scraped_dir)):
        if not filename.startswith('course_') or not filename.endswith('.txt'):
            continue

        gdo_id = filename.replace('course_', '').replace('.txt', '')
        fallback_name = id_map.get(gdo_id, f'コース {gdo_id}')

        filepath = os.path.join(scraped_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()

        prefecture = get_prefecture_for_id(gdo_id)
        parsed = parse_course_text(text, gdo_id, fallback_name, prefecture)
        for course in parsed:
            if course['id'] in existing_ids:
                continue
            n_holes = len(course['holes'])
            total_par = course['totalPar']
            # Skip short/executive courses (all par-3): par ≤54 for 18H
            if n_holes >= 18 and total_par <= 54:
                skipped += 1
                print(f"  Skipped (short/par-3 course): {course['name']} (par {total_par})")
            elif n_holes >= 18:
                all_courses.append(course)
                existing_ids.add(course['id'])
                added += 1
                print(f"  Added: {course['name']} ({n_holes} holes, par {total_par})")
            else:
                skipped += 1
                print(f"  Skipped (< 18 holes): {course['name']} ({n_holes} holes)")

    # Sort by 50-on (Japanese syllabary) order and write output
    all_courses.sort(key=_sort_key)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_courses, f, ensure_ascii=False, indent=2)

    print(f"\nAdded: {added}, Skipped: {skipped}")
    print(f"Total courses in {output_file}: {len(all_courses)}")
    return all_courses


if __name__ == '__main__':
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    output = os.path.join(os.path.dirname(scripts_dir), 'data', 'courses.json')
    merge_results(scripts_dir, output)
