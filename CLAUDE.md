# Golf Las Vegas App - Development Notes

## GDOコーススクレイピング手順（再開用）

### 概要
都道府県のゴルフコース情報（HOLE/PAR/HDCP/ヤード）をGDO（Golf Digest Online）から取得してcourses.jsonに追加する作業。

### 現状
- **千葉県**: 161コース中144コース取得済み（17コースは9Hまたは27H施設のためスキップ）
- **神奈川県**: 56コース取得済み
- **合計**: 207コース（50音順でソート済み）
- 取得済みテキストデータ: `scripts/scraped/course_{ID}.txt`
- コースID一覧: `scripts/chiba_course_ids.json`、`scripts/kanagawa_course_ids.json`

### スクレイピング手順

#### Step 1: 未取得コースの確認
```python
# 未取得コースIDの取得
python3 -c "
import json, os
with open('scripts/chiba_course_ids.json') as f:
    all_courses = json.load(f)
scraped = set()
for fn in os.listdir('scripts/scraped'):
    if fn.startswith('course_') and fn.endswith('.txt'):
        scraped.add(fn.replace('course_','').replace('.txt',''))
remaining = [c for c in all_courses if c['id'] not in scraped]
print(f'Remaining: {len(remaining)} courses')
for c in remaining:
    print(f'  {c[\"id\"]}: {c[\"name\"]}')
"
```

#### Step 2: WebFetchでコースデータを取得
各コースIDに対して以下のURLをWebFetchで取得:
```
https://reserve.golfdigest.co.jp/golf-course/course-layout/{courseID}
```

WebFetchのプロンプト:
```
Extract all hole-by-hole data including hole number, par, handicap (HDCP), and yardage for each course/sub-course (OUT/IN, 東/西/南 etc). Format as markdown tables.
```

**注意事項:**
- 5コースずつ並列でWebFetchを実行する
- Background Taskエージェントを使って並列化可能
- Python urllibは403でブロックされるため使用不可
- WebFetchツールのみが正常にアクセス可能

#### Step 3: 取得結果をテキストファイルに保存
保存先: `scripts/scraped/course_{ID}.txt`

**期待されるデータ形式（Format A - シンプル形式）:**
```
## コース名
### OUT
| 1 | 5 | 15 | 469 |
| 2 | 4 | 3 | 325 |
...
### IN
| 10 | 4 | 10 | 352 |
...
```

**期待されるデータ形式（Format B - 詳細形式）:**
```
# コース名 - Hole-by-Hole Data

## OUT (Holes 1-9)

| Hole | Par | HDCP | Yardage |
|------|-----|------|---------|
| 1 | 5 | 9 | 573 |
...
```

**36ホール（東/西）や27ホール（さくら/かえで/まつ等）のコースの場合:**
```
### 東OUT
| 1 | 5 | 13 | 464 |
...
### 東IN
| 10 | 5 | 12 | 502 |
...
### 西OUT
| 1 | 4 | 5 | 363 |
...
```

#### Step 4: courses.jsonの生成
```bash
cd /home/user/golf-LasVegas-app
python3 scripts/parse_gdo.py
```

パーサー（`scripts/parse_gdo.py`）が以下を行う:
1. `data/courses.json` の既存データを読み込み
2. 既存コースの名前クリーニング・都道府県修正を適用
3. `scripts/scraped/course_*.txt` を全てパース（全都道府県対象）
4. 18ホール以上・パー55以上のコースのみ追加
5. **コース名から不要なメタデータを自動除去**:
   - `Golf Course Data:` / `Course Name:` プレフィックス
   - `- ホール別データ` / `- Course Data` / `- Hole-by-Hole Data` サフィックス
6. **50音順（カタカナ→ひらがな変換）でソート**して `data/courses.json` に書き出し

#### Step 5: 新しい都道府県を追加する場合
1. `scripts/{prefecture}_course_ids.json` を作成（例: `tokyo_course_ids.json`）
2. `parse_gdo.py` の `get_prefecture_for_id()` にIDプレフィックスと都道府県名を追加
3. `merge_results()` のIDマップ読み込み部分に新ファイルを追加
4. スクレイピング後に `python3 scripts/parse_gdo.py` を実行

### コース分類
- **標準18ホール**: OUT(1-9) + IN(10-18) → そのまま1コースとして登録
- **36ホール（東/西等）**: 東OUT+東IN(18H) + 西OUT+西IN(18H) → 2コースとして登録
- **27ホール（3x9）**: さくら/かえで/まつ等 → 各9ホール、18ホール未満はスキップ
- **ショートコース**: パー54以下（全ホールpar3）→ スキップ

### テーブル形式の対応（parse_gdo.py）
パーサーは以下の複数フォーマットに対応:
- `Hole | Par | HDCP | Yardage(s)` ← HDCPが3列目
- `Hole | Par | Yardage(s) | HDCP` ← HDCPが最終列
- HDCP が `—` または `-` の場合は 0 として扱う
- 複数ヤーデージ列がある場合は最初の列（最長ティー）を使用
- INコースのホール番号が1-9の場合は自動的に10-18に変換

### URL パターン
- コース一覧: `https://reserve.golfdigest.co.jp/course-guide/area/{code}/`
- コースレイアウト: `https://reserve.golfdigest.co.jp/golf-course/course-layout/{courseID}`
- 都道府県コード: 東京=13, 千葉=12, 神奈川=14, 大阪=27, 兵庫=28

### GDO コースIDプレフィックス対応表
| 都道府県 | IDプレフィックス | IDファイル |
|---------|---------------|-----------|
| 千葉県 | 35xxxx | chiba_course_ids.json |
| 神奈川県 | 37xxxx | kanagawa_course_ids.json |
| 東京都 | 13xxxx | (未作成) |

### ファイル構成
```
scripts/
  chiba_course_ids.json      # 千葉県全161コースのID一覧
  kanagawa_course_ids.json   # 神奈川県全55コースのID一覧
  parse_gdo.py               # テキスト→JSON変換パーサー（全都道府県対応）
  scraped/                   # 取得済みテキストデータ
    course_350101.txt        # 千葉県コース (35xxxx)
    course_370101.txt        # 神奈川県コース (37xxxx)
    ...
data/
  courses.json               # アプリで使用するコースデータ（50音順）
```
