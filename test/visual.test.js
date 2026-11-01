import test from 'node:test';
import assert from 'node:assert/strict';
import { wheelNodes, moonShape, ELEMENTS } from '../docs/lib/visual.js';
import { fallbackReading, RELATION } from '../docs/lib/fallback.js';
import { buildFacts } from '../docs/lib/calc.js';
import { ENERGY, SLEEP, MOOD, FOCUS } from '../docs/lib/condition.js';

test('五行の円環: 木が真上、相生の順に時計回りで、中心から等距離', () => {
  const nodes = wheelNodes(100, 100, 60);
  assert.deepEqual(nodes.map((n) => n.name), ELEMENTS);
  assert.ok(Math.abs(nodes[0].x - 100) < 1e-9 && Math.abs(nodes[0].y - 40) < 1e-9, '木は真上');
  assert.ok(nodes[1].x > 100, '火は右側(時計回り)');
  for (const n of nodes) assert.ok(Math.abs(Math.hypot(n.x - 100, n.y - 100) - 60) < 1e-9);
});

test('月の形: 新月は描かず、満月は円全体、上弦は半円、欠けていく間は左右反転', () => {
  assert.equal(moonShape(0).lit, null); // 新月
  assert.equal(moonShape(29.4).lit, null); // 新月直前
  const full = moonShape(14.7); // 満月の直前(ちょうど半周は左右どちらでも同じ円)
  assert.equal(full.full, true);
  assert.equal(full.waning, false);
  const first = moonShape(7.38); // 上弦: 境界が直線(rx≈0)
  assert.match(first.lit, /A 0\.\d+ 16/);
  assert.equal(first.waning, false);
  assert.equal(moonShape(22.1).waning, true); // 下弦
  assert.equal(moonShape(3).full, false);
});

test('簡易診断: 全パターンで応援メッセージの見出しが20字以内、関係ごとの要約もある', () => {
  for (const k of Object.keys(RELATION)) assert.equal(RELATION[k].length, 3);
  const facts = buildFacts({ birthDate: '1980-06-15', today: '2026-11-01' });
  const titles = new Set();
  for (const e of ENERGY) for (const s of SLEEP) for (const m of MOOD) for (const f of FOCUS) {
    const r = fallbackReading(facts, { energy: e.v, sleep: s, mood: m, focus: f, memo: '' }, 'x');
    assert.ok(r.boost_title && r.boost_title.length <= 20, r.boost_title);
    titles.add(r.boost_title);
  }
  assert.equal(titles.size, 5, 'モードの数だけ見出しがある');
});
