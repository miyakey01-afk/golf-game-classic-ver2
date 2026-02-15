#!/usr/bin/env python3
"""Parse scraped GDO course data text files into courses.json format.

Two data formats are handled:
  Format A (simple): ## CourseName / ### OUT / | hole | par | hdcp | yard |
  Format B (detailed): # Name - Hole-by-Hole Data / ## OUT (Holes 1-9) / | Hole | Par | HDCP | Yardage | with header+separator rows
"""
import json
import re
import os
import sys


def parse_course_text(text, gdo_id, fallback_name):
    """Parse the text output from WebFetch for a single course."""
    courses = []
    lines = text.strip().split('\n')

    # Extract course name from text
    course_name = fallback_name
    for line in lines[:10]:
        cleaned = line.strip().strip('#').strip()
        # Remove trailing " - Hole-by-Hole Data" etc.
        cleaned = re.sub(r'\s*[-–]\s*Hole.*$', '', cleaned).strip()
        if cleaned and any(kw in cleaned for kw in ['コース', 'ゴルフ', 'カントリー', '倶楽部', 'クラブ', 'カンツリー']):
            course_name = cleaned.split('|')[0].strip().strip('#').strip()
            # Remove markdown bold markers
            course_name = course_name.replace('**', '').strip()
            break

    # Collect hole data by course sub-label
    hole_data = {}  # {course_label: {hole_num: {par, hdcp, yardage}}}
    current_section = None

    for line in lines:
        line = line.strip()

        # Skip header rows and separator rows
        if re.match(r'\|[\s\-:]+\|', line):
            continue
        if re.match(r'\|\s*Hole\s*\|', line, re.IGNORECASE):
            continue

        # Detect section headers
        # Pattern: ### OUT, ### 東OUT, ## IN (Holes 10-18), ## SAKURA (Cherry) Course, etc.
        section_match = re.match(r'#+\s*(.*?(?:OUT|IN).*?)(?:\s*$)', line, re.IGNORECASE)
        if not section_match:
            section_match = re.match(r'\*\*\s*(.*?(?:OUT|IN).*?)\s*\*\*', line, re.IGNORECASE)
        if section_match:
            current_section = section_match.group(1).strip()
            # Remove parenthetical like "(Holes 1-9)", "(Front 9)"
            current_section = re.sub(r'\(.*?\)', '', current_section).strip()
            continue

        # Also detect Japanese named course sections (27-hole courses)
        # e.g. "## SAKURA (Cherry) Course", "## さくらコース"
        named_match = re.match(r'#+\s*(.*(?:SAKURA|KAEDE|MATSU|さくら|かえで|まつ|つつじ|さつき|Cherry|Maple|Pine).*?)$', line, re.IGNORECASE)
        if named_match and not current_section:
            current_section = named_match.group(1).strip()
            continue

        # Parse table rows: | hole | par | hdcp | yard | (possibly more columns)
        row_match = re.match(r'\|?\s*(\d{1,2})\s*\|\s*(\d)\s*\|\s*(\d{1,2})\s*\|\s*(\d+)\s*\|?', line)
        if row_match and current_section:
            hole_num = int(row_match.group(1))
            par = int(row_match.group(2))
            hdcp = int(row_match.group(3))
            yard = int(row_match.group(4))

            # Determine course label from section name
            label = _extract_label(current_section)

            if label not in hole_data:
                hole_data[label] = {}
            hole_data[label][hole_num] = {'par': par, 'hdcp': hdcp, 'yardage': yard}

    # Build course entries from collected data
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

        holes_arr = []
        for h_num in sorted(holes.keys()):
            h = holes[h_num]
            holes_arr.append({
                'hole': h_num,
                'par': h['par'],
                'hdcp': h['hdcp'],
                'yardage': h.get('yardage', 0)
            })

        courses.append({
            'id': course_id,
            'name': full_name,
            'prefecture': '千葉県',
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

    # Load course ID mapping
    ids_file = os.path.join(scripts_dir, 'chiba_course_ids.json')
    with open(ids_file, 'r', encoding='utf-8') as f:
        course_ids = json.load(f)
    id_map = {c['id']: c['name'] for c in course_ids}

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

        parsed = parse_course_text(text, gdo_id, fallback_name)
        for course in parsed:
            if course['id'] not in existing_ids and len(course['holes']) >= 18:
                all_courses.append(course)
                existing_ids.add(course['id'])
                added += 1
                print(f"  Added: {course['name']} ({len(course['holes'])} holes, par {course['totalPar']})")
            elif course['id'] not in existing_ids:
                skipped += 1
                print(f"  Skipped (< 18 holes): {course['name']} ({len(course['holes'])} holes)")

    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_courses, f, ensure_ascii=False, indent=2)

    print(f"\nAdded: {added}, Skipped: {skipped}")
    print(f"Total courses in {output_file}: {len(all_courses)}")
    return all_courses


if __name__ == '__main__':
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    output = os.path.join(os.path.dirname(scripts_dir), 'data', 'courses.json')
    merge_results(scripts_dir, output)
