# DCL — 方向約束鎖定演算法

一種以空間移動行為驅動的多維篩選演算法。

使用者不是事先設定篩選條件，而是透過在二維畫布上的 **8 個方向移動** 來累積約束條件。每一次移動都會鎖定一個維度的值；鎖定的條件持續累積，最終形成一個由移動軌跡定義的多維交集查詢。

**核心精神：「你走到哪，條件就鎖到哪」**

## 運作方式

```
     ↖  ↑  ↗
      \ | /
   ←  ─ ● ─  →
      / | \
     ↙  ↓  ↘
```

1. 每張卡片在 8 個方向各持有一個從 **{1…N} 中選出的相異數值**（N 可設定，預設為 8）— 不重複。當 N = 8 時為完整排列；當 N > 8 時為部分排列 P(N,8)。
2. 第一次往某方向移動時，會將該維度**鎖定**為當前卡片的值。
3. 所有符合已鎖定條件的卡片形成一個**循環池（Loop Pool）**，持續移動即在池中循環。
4. 條件只增不減（最多 8 個）。當沒有卡片符合所有條件時，**最早鎖定的條件優先釋放**（FIFO 解鎖），保證永遠不會卡死。

## 快速範例

```
起點：卡片 A  {→:8, ↑:7, ↗:6, ←:3, ↓:4, ↖:2, ↘:5, ↙:1}

第 1 步：往右移動 → 鎖定 →=8
        候選池：所有 →=8 的卡片 → 進入卡片 B

第 2 步：往上移動 → 追加鎖定 ↑=7（卡片 B 的 ↑ 值）
        候選池：→=8 AND ↑=7 → 更小的集合

第 3 步：往右上移動 → 追加鎖定 ↗=...
        候選池：→=8 AND ↑=7 AND ↗=? → 更窄的範圍
```

## 線上 Demo

互動式 demo：**[reidevbx.github.io/dcl](https://reidevbx.github.io/dcl)**（或在本地運行 — 見下方）。

Demo 提供 [英文](https://reidevbx.github.io/dcl) 和 [繁體中文](https://reidevbx.github.io/dcl/zh/) 版本。

## 文件

| 文件 | 說明 |
|------|------|
| [演算法規格書（中文）](docs/zh/specification.md) | 形式化定義、性質證明、複雜度分析 |
| [演算法規格書（English）](docs/en/specification.md) | Formal definition, properties, and proofs |
| [概念文件（中文）](docs/zh/concept.md) | 原始概念構想與設計思考 |
| [Concept Document（English）](docs/en/concept.md) | Concept writeup and design thinking |

## 本地運行

Demo 是純靜態檔案，零依賴。

```bash
# 克隆
git clone https://github.com/reidevbx/dcl.git
cd dcl

# 啟動服務（任何靜態服務器都可以）
npx serve public
# 或
python3 -m http.server -d public 8000
```

開啟 `http://localhost:8000`（`serve` 預設為 `3000`）。

## 部署

透過 [GitHub Pages](https://pages.github.com) 部署。推送到 `main` 會自動透過 GitHub Actions 部署。

啟用方式：到 repo **Settings > Pages > Source**，選擇 **GitHub Actions**。

## 專案結構

```
dcl/
├── public/
│   ├── index.html        # 互動式 Demo（英文）
│   ├── zh/index.html     # 互動式 Demo（繁中）
│   ├── style.css         # 共用樣式
│   ├── dcl.js            # 演算法核心（可獨立引用）
│   └── demo.js           # UI 渲染層
├── docs/
│   ├── en/
│   │   ├── specification.md  # 演算法規格書（英文）
│   │   └── concept.md        # 概念文件（英文）
│   └── zh/
│       ├── specification.md  # 演算法規格書（中文）
│       └── concept.md        # 概念文件（中文）
├── .github/workflows/
│   └── deploy.yml        # GitHub Pages 自動部署
├── package.json
├── LICENSE
├── README.md             # 英文 README
└── README.zh.md          # 繁體中文 README（本文件）
```

## 潛在應用場景

- **穿搭探索**：版型、色調、風格、場合等維度
- **音樂探索**：節奏、情緒、樂器、年代等維度
- **選品工具**：材質、價格區間、風格、品牌調性等
- **靈感牆**：在視覺風格空間裡自由漂流
- 任何需要多維探索但不想讓使用者面對複雜篩選介面的場景

## 插件系統

DCL 支援可選的插件架構。插件可以擴展引擎功能，而不改動核心演算法。

```js
var engine = DCL.create({ cardCount: 100 });

// 可選：啟用記憶插件
DCL.use(engine, 'memory');

engine.navigate('right');
engine.navigate('up');
engine.undo();       // 回到前一張卡片（鎖定狀態維持不變）
engine.canUndo();    // true / false
```

### 內建插件

| 插件 | 新增方法 | 說明 |
|------|---------|------|
| `memory` | `undo()`, `canUndo()` | 記錄卡片歷史。回退時切回前一張卡片，鎖定狀態不變，候選池根據當前約束重新計算。 |

### 自訂插件

```js
DCL.register('myPlugin', function (engine) {
  // 包裝或擴展 engine 的方法
});
DCL.use(engine, 'myPlugin');
```

## 演算法性質

| 性質 | 保證 |
|------|------|
| 單調累積 | \|L\| 只增不減（除非 FIFO 解鎖觸發） |
| 最大約束數 | \|L\| ≤ 8 |
| 無死路 | FIFO 解鎖保證 P ≠ ∅（只要 \|C\| > 1） |
| 循環導航 | 有限候選池 → 循環回到起點 |
| 選取約束 | A(c, ·) 從 {1…N} 中選取 8 個相異值 → 每張卡片的值不重複 |

## 待探索問題

- 8 個方向的維度語意由產品方固定？還是隨內容動態生成？
- 數值是否可支援模糊匹配（例如 ±1 容差），以增加小資料集的候選池？
- 如何透過 AI（如 CLIP embedding）自動產生方向數值？

## 授權

[MIT](LICENSE)
