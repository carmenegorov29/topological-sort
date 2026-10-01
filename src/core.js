/**
 * Topological sort over a named directed graph.
 *
 * Returns one valid order. Because DFS-based topo sort always visits
 * a node's dependencies before the node itself, a node appears only
 * after everything it depends on. When multiple valid orders exist,
 * the result is deterministic: it follows the insertion order of the
 * keys in `dependencies`, and within a node's dependency list, the
 * order given. That predictability matters for tests and for diffing
 * generated output, so we accept the constraint that callers must sort
 * their inputs if they want a different order.
 *
 * Self-loops and multi-edges are cycles and duplicates respectively;
 * both are reported as-is rather than silently normalized, because a
 * silent fix hides a caller bug.
 *
 * @param {Map<string, Iterable<string>> | Record<string, Iterable<string>>} dependencies
 *   Each key is a node; its value is the iterable of nodes it depends on.
 *   A node need not appear as a key if it has no dependencies itself,
 *   but any node named as a dependency of another that is not itself a
 *   key is treated as a no-dependency leaf.
 * @returns {string[]} Nodes in dependency order.
 * @throws {Error} When the graph contains a cycle. The message lists
 *   the nodes on the cycle in walk order, starting and ending at the
 *   same node, e.g. "a -> b -> c -> a".
 */
export function topologicalSort(dependencies) {
  const adjacency = normalizeDependencies(dependencies);

  // Visit states: 'white' = unvisited, 'gray' = on current DFS stack,
  // 'black' = fully processed. Gray is what lets us detect a back edge.
  const color = new Map();
  for (const node of adjacency.keys()) {
    color.set(node, 'white');
  }

  const order = [];
  // Stack of {node, iterator} so we can resume a node's children after
  // returning from a recursive child. This mirrors recursion without the
  // call stack, which keeps the failure mode (cycle detection) and the
  // success path in one place and avoids deep-recursion crashes on
  // large graphs.
  const stack = [];

  for (const startNode of adjacency.keys()) {
    if (color.get(startNode) !== 'white') continue;

    color.set(startNode, 'gray');
    stack.push({ node: startNode, iterator: adjacency.get(startNode)[Symbol.iterator]() });

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const step = top.iterator.next();
      if (step.done) {
        color.set(top.node, 'black');
        order.push(top.node);
        stack.pop();
        continue;
      }

      const dep = step.value;
      if (typeof dep !== 'string') {
        throw new TypeError(
          `Dependency identifier must be a string, got ${typeof dep} for "${top.node}"`
        );
      }

      const depColor = color.get(dep);
      if (depColor === 'black') {
        // Already fully processed; no action needed.
        continue;
      }
      if (depColor === 'gray') {
        // Back edge: `dep` is still on the stack. The cycle is the slice
        // of the stack from `dep` to the current node, plus `dep` again
        // so the cycle reads start-to-end.
        const cycle = [];
        let collecting = false;
        for (const frame of stack) {
          if (frame.node === dep) collecting = true;
          if (collecting) cycle.push(frame.node);
        }
        cycle.push(dep);
        throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }

      // White: descend.
      color.set(dep, 'gray');
      stack.push({ node: dep, iterator: adjacency.get(dep)[Symbol.iterator]() });
    }
  }

  return order;
}

/**
 * Coerce the input into a Map of arrays and ensure every dependency
 * named by any node also has an entry, so the DFS never has to create
 * nodes mid-walk (which would complicate iteration-order guarantees).
 */
function normalizeDependencies(dependencies) {
  if (dependencies === null || dependencies === undefined) {
    throw new TypeError('dependencies must be a Map or object');
  }
  if (typeof dependencies !== 'object') {
    throw new TypeError(`dependencies must be a Map or object, got ${typeof dependencies}`);
  }

  const normalized = new Map();

  const entries =
    dependencies instanceof Map
      ? dependencies.entries()
      : Object.entries(dependencies);

  for (const [node, deps] of entries) {
    if (typeof node !== 'string') {
      throw new TypeError(`Node identifier must be a string, got ${typeof node}`);
    }
    if (deps === null || deps === undefined) {
      throw new TypeError(`Dependencies for "${node}" must be iterable, got ${typeof deps}`);
    }
    const depList = Array.from(deps);
    for (const d of depList) {
      if (typeof d !== 'string') {
        throw new TypeError(
          `Dependency of "${node}" must be a string, got ${typeof d}`
        );
      }
    }
    // Preserve the order of dependencies as given, duplicates included.
    normalized.set(node, depList);
  }

  // Ensure every named dependency is present as a key so the DFS has
  // a stable color entry and a child iterator to consume.
  for (const [, deps] of normalized) {
    for (const dep of deps) {
      if (!normalized.has(dep)) normalized.set(dep, []);
    }
  }

  return normalized;
}
