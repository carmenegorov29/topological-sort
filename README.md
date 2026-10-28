# Topological Sort

Orders a named dependency graph and reports any cycle by the names of the nodes on it. Returns one valid order; when several exist, the result is deterministic and follows the insertion order of the input.

## Usage

```js
import { topologicalSort } from 'topological-sort';

const order = topologicalSort({
  build: ['compile', 'test'],
  test: ['compile'],
  compile: [],
});
// order is e.g. ['compile', 'test', 'build']
```

Accepts either a plain object or a `Map`. Each key is a node; its value is an iterable of the nodes it depends on. A node named as a dependency that has no entry of its own is treated as a no-dependency leaf. Returns `string[]` in dependency order. Throws an `Error` with a message of the form `Circular dependency detected: a -> b -> a` when a cycle is found.

## Why

I needed a topological sort for build-order and config-resolution tasks where (a) the node names are meaningful and should appear in any error message, (b) there is no network and no package install step, and (c) the output has to be diffable across runs. The trade-off taken: the library returns exactly one order, deterministic by input key order, rather than exposing every valid order or a generator. That is less flexible but makes test snapshots and generated artifacts stable.

## Edge case worth knowing

If multiple valid orders exist, the library does not consider them equally — it commits to the order implied by your input. Sort your input (keys and each dependency list) if you want a different deterministic result. Duplicates in a dependency list are left in place rather than deduplicated silently; a self-edge (`a: ['a']`) is a cycle and is reported as such.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Limitations

Values are coerced to floats, so very large integers lose precision. If you need
exact integer aggregates over a window, this is the wrong tool.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

