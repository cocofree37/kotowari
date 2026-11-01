import test from 'node:test';
import assert from 'node:assert/strict';
import { dayPillar, sunSign, lifePathNumber, etoOfYear, hourBranch, buildFacts, elementRelation } from '../docs/lib/calc.js';

test('日柱: 2000-01-01 は戊午', () => {
  assert.equal(dayPillar(2000, 1, 1).name, '戊午');
});

test('星座の境界', () => {
  assert.equal(sunSign(1, 19), '山羊座');
  assert.equal(sunSign(1, 20), '水瓶座');
  assert.equal(sunSign(3, 20), '魚座');
  assert.equal(sunSign(3, 21), '牡羊座');
  assert.equal(sunSign(12, 21), '射手座');
  assert.equal(sunSign(12, 22), '山羊座');
  assert.equal(sunSign(12, 31), '山羊座');
});

test('ライフパスナンバー', () => {
  assert.equal(lifePathNumber(1990, 5, 15), 3); // 30 -> 3
  assert.equal(lifePathNumber(1990, 1, 2), 22); // 22 はマスターナンバー
});

test('干支は立春前なら前年', () => {
  assert.equal(etoOfYear(2000, 1, 15).animal, 'ウサギ'); // 1999年 = 己卯
  assert.equal(etoOfYear(2000, 2, 4).animal, 'タツ'); // 2000年 = 庚辰
});

test('時支', () => {
  assert.equal(hourBranch('23:30'), '子');
  assert.equal(hourBranch('00:10'), '子');
  assert.equal(hourBranch('12:00'), '午');
  assert.equal(hourBranch(''), null);
});

test('不正な日付はエラー', () => {
  assert.throws(() => buildFacts({ birthDate: '2001-02-30', today: '2026-09-19' }));
});

test('五行の関係', () => {
  assert.equal(elementRelation('甲', '乙').kind, 'same'); // 木と木
  assert.equal(elementRelation('甲', '丙').kind, 'gives'); // 木は火を生む
  assert.equal(elementRelation('丙', '甲').kind, 'receives'); // 木が火を生む
  assert.equal(elementRelation('甲', '戊').kind, 'controls'); // 木は土を剋す
  assert.equal(elementRelation('戊', '甲').kind, 'controlled'); // 木に土は剋される
  assert.deepEqual(buildFacts({ birthDate: '1990-05-15', today: '2026-11-01' }).relation.birthElement, '金'); // 庚辰
});
