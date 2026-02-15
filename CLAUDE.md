# Golf Las Vegas App - Development Notes

## GDOコーススクレイピング手順（再開用）

### 概要
千葉県のゴルフコース情報（HOLE/PAR/HDCP/ヤード）をGDO（Golf Digest Online）から取得してcourses.jsonに追加する作業。

### 進捗状況
- **全161コース中、80コース取得済み、81コース未取得**
- 進捗ファイル: `scripts/scraping_progress.json`
- 取得済みテキストデータ: `scripts/scraped/course_{ID}.txt`
- コースID一覧: `scripts/chiba_course_ids.json`

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
2. `scripts/scraped/course_*.txt` を全てパース
3. 18ホール以上のコースのみ追加
4. 結果を `data/courses.json` に書き出し

#### Step 5: scraping_progress.jsonの更新
取得完了後、`scripts/scraping_progress.json` の scraped_ids / remaining_ids を更新する。

### コース分類
- **標準18ホール**: OUT(1-9) + IN(10-18) → そのまま1コースとして登録
- **36ホール（東/西等）**: 東OUT+東IN(18H) + 西OUT+西IN(18H) → 2コースとして登録
- **27ホール（3x9）**: さくら/かえで/まつ等 → 各9ホール、18ホール未満はスキップ
- **ショートコース**: HDCP無し → スキップ

### URL パターン
- コース一覧: `https://reserve.golfdigest.co.jp/golf-course/area/12/` (12=千葉県)
- コースレイアウト: `https://reserve.golfdigest.co.jp/golf-course/course-layout/{courseID}`
- 都道府県コード: 東京=13, 千葉=12, 神奈川=14

### ファイル構成
```
scripts/
  chiba_course_ids.json   # 千葉県全161コースのID一覧
  scraping_progress.json  # スクレイピング進捗管理
  parse_gdo.py            # テキスト→JSON変換パーサー
  scraped/                # 取得済みテキストデータ
    course_350101.txt
    course_350102.txt
    ...
data/
  courses.json            # アプリで使用するコースデータ（最終出力）
```
