import { PresetItem } from '../types';

export const DEFAULT_PRESETS: PresetItem[] = [
  {
    id: 'preset-system-example-chain',
    title: '連立例題 (2.5A + 5B = 10C / 30C = 20D / B = 480 × 6)',
    description: '3段階の式と連鎖変数を自動解決する複合例題',
    category: 'custom',
    equations: [
      '2.5A + 5B = 10C',
      '30C = 20D',
      'B = 480 * 6',
    ],
    variableMemos: {
      A: '主原料ロット',
      B: '添加ベース（480×6包）',
      C: '中間生成物',
      D: '最終完成ロット',
    },
  },
  {
    id: 'preset-system-cost-profit',
    title: '原価・売上・利益バランス連立',
    description: '売上 = 原価 + 利益, 原価 = 500A + 300B, 利益 = 0.25 * 売上',
    category: 'business',
    equations: [
      '売上 = 原価 + 利益',
      '原価 = 500A + 300B',
      '利益 = 0.25 * 売上',
      'A = 100',
      'B = 200',
    ],
    variableMemos: {
      売上: '目標販売総額',
      原価: '製造・仕入れ原価',
      利益: '粗利益額 (25%)',
      A: '部品A仕入数 (単価500円)',
      B: '部品B仕入数 (単価300円)',
    },
  },
  {
    id: 'preset-system-2vars-math',
    title: '2元連立1次方程式 (2x + 3y = 13, 5x - y = 7)',
    description: '基本の連立方程式をガウス消去法で厳密計算',
    category: 'math',
    equations: [
      '2x + 3y = 13',
      '5x - y = 7',
    ],
    variableMemos: {
      x: '第1未知数',
      y: '第2未知数',
    },
  },
  {
    id: 'preset-system-3vars-math',
    title: '3元連立1次方程式 (x, y, z)',
    description: '3つの式から x, y, z の未知数を一括特定',
    category: 'math',
    equations: [
      'x + y + z = 6',
      '2x - y + 3z = 9',
      '-x + 2y - z = -2',
    ],
    variableMemos: {
      x: '未知数X',
      y: '未知数Y',
      z: '未知数Z',
    },
  },
  {
    id: 'preset-ratio-chain',
    title: '多項比率・合計連動 (A : B : C = 2 : 3 : 5, 合計 = 1000)',
    description: '比率関係と合計の連立式',
    category: 'math',
    equations: [
      '3A = 2B',
      '5B = 3C',
      'A + B + C = 1000',
    ],
    variableMemos: {
      A: '配合成分A (比率2)',
      B: '配合成分B (比率3)',
      C: '配合成分C (比率5)',
    },
  },
];
