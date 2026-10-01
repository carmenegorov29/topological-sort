import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topologicalSort } from '../src/index.js';

// Returns true if every element of `arr` appears after every element of
// `prereqs`. Used instead of checking exact positions so the tests don't
// lock in a particular valid order when several exist.
function respects(arr, prereqs) {
  const index = new Map(arr.map((n, i) => [n, i]));
  for (const p of prereqs) {
    if (!index.has(p)) return false;
  }
  for (const n of arr) {
    for (const p of prereqs) {
      if (n === p) continue;
      if (index.get(n) < index.get(p)) return false;
    }
  }
  return true;
}

function cycleFromMessage(message) {
  const match = /Circular dependency detected: (.+)$/.exec(message);
  assert.ok(match, `Unexpected error message: ${message}`);
  return match[1].split(' -> ');
}

test('orders a simple chain', () => {
  const deps = { c: ['b'], b: ['a'], a: [] };
  const order = topologicalSort(deps);
  assert.deepEqual([...order].sort(), ['a', 'b', 'c']);
  assert.equal(order[order.length - 1], 'c');
  assert.equal(order[0], 'a');
});

test('orders a diamond dependency', () => {
  const deps = {
    d: ['b', 'c'],
    b: ['a'],
    c: ['a'],
    a: [],
  };
  const order = topologicalSort(deps);
  assert.deepEqual([...order].sort(), ['a', 'b', 'c', 'd']);
  assert.ok(respects(order, ['a']), 'a must come before everything depending on it');
  assert.equal(order[order.length - 1], 'd');
});

test('handles a node with no dependencies entry', () => {
  const deps = { b: ['a'] };
  const order = topologicalSort(deps);
  assert.deepEqual([...order].sort(), ['a', 'b']);
  assert.equal(order[order.length - 1], 'b');
});

test('empty graph returns empty array', () => {
  assert.deepEqual(topologicalSort({}), []);
});

test('Map input works the same as object input', () => {
  const deps = new Map([
    ['c', ['b']],
    ['b', ['a']],
    ['a', []],
  ]);
  const order = topologicalSort(deps);
  assert.deepEqual(order, ['a', 'b', 'c']);
});

test('isolated nodes are all returned', () => {
  const deps = { a: [], b: [], c: [] };
  const order = topologicalSort(deps);
  assert.deepEqual([...order].sort(), ['a', 'b', 'c']);
});

test('duplicate dependencies do not corrupt the order', () => {
  const deps = { b: ['a', 'a'], a: [] };
  const order = topologicalSort(deps);
  assert.deepEqual(order, ['a', 'b']);
});

test('self-loop is reported as a cycle', () => {
  const deps = { a: ['a'] };
  assert.throws(
    () => topologicalSort(deps),
    (err) => {
      const cycle = cycleFromMessage(err.message);
      assert.deepEqual(cycle, ['a', 'a']);
      return true;
    }
  );
});

test('two-node cycle is reported with the cycle path', () => {
  const deps = { a: ['b'], b: ['a'] };
  assert.throws(
    () => topologicalSort(deps),
    (err) => {
      const cycle = cycleFromMessage(err.message);
      assert.deepEqual(cycle, ['a', 'b', 'a']);
      return true;
    }
  );
});

test('cycle nested off a reachable node is still detected', () => {
  const deps = {
    a: ['b'],
    b: ['c'],
    c: ['b'], // b <-> c cycle, a depends on b
  };
  assert.throws(
    () => topologicalSort(deps),
    (err) => {
      const cycle = cycleFromMessage(err.message);
      assert.deepEqual(cycle, ['b', 'c', 'b']);
      return true;
    }
  );
});

test('cycle message starts and ends at the same node', () => {
  const deps = {
    entry: ['x'],
    x: ['y'],
    y: ['z'],
    z: ['x'],
  };
  assert.throws(
    () => topologicalSort(deps),
    (err) => {
      const cycle = cycleFromMessage(err.message);
      assert.equal(cycle[0], cycle[cycle.length - 1], 'cycle must close');
      assert.ok(cycle.length >= 3, 'a real cycle has at least two distinct nodes plus close');
      return true;
    }
  );
});

test('large chain does not overflow the stack', () => {
  const deps = {};
  const n = 5000;
  for (let i = 0; i < n; i++) {
    deps[`n${i}`] = i > 0 ? [`n${i - 1}`] : [];
  }
  const order = topologicalSort(deps);
  assert.equal(order.length, n);
  assert.equal(order[0], 'n0');
  assert.equal(order[order.length - 1], `n${n - 1}`);
});
