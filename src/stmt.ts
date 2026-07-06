import type { _type } from './types.js'
import { next_type } from './types.js'

import type { Node } from './ast.js'

import type { Symbol } from './scope.js'

import { next_expr_node } from './expr.js'

import { max_depth, max_block_stmts } from './const.js'


const next_name_ids = new Map<string, number>();

// fresh, unique-per-prefix name - SPEC.md §7.2 disallows shadowing (not just
// same-scope redeclaration), checked against every enclosing scope up to
// global, and functions/structs/globals/locals all share one namespace. A
// monotonic counter per prefix sidesteps the check entirely rather than
// needing to search the whole scope stack for a free name - distinct
// prefixes (e.g. "v" for locals, "f" for functions) can never collide with
// each other regardless of their counters, so callers can also tell one
// category of name from another at a glance.
export function next_fresh_name(prefix: string): string {
  const id = next_name_ids.get(prefix) ?? 0;
  next_name_ids.set(prefix, id + 1);
  return `${prefix}${id}`;
}


function next_vardecl_node(symbol_table: Map<string, Symbol>[], depth: number): Node {
  const type = next_type(symbol_table, false, depth);
  const name = next_fresh_name("v");

  // a bare struct type has no literal fallback yet (Name{...} initializer
  // expressions aren't generated anywhere) - SPEC.md §5.1 shows exactly this
  // as the idiomatic no-initializer pattern, so skip the initializer rather
  // than crash. Struct* is fine either way since a null-pointer literal
  // doesn't care about pointee kind.
  const can_have_init = !(type.kind === "struct" && type.ptr_depth === 0);
  const init = can_have_init && Math.random() < 0.5
    ? next_expr_node(type, symbol_table, depth + 1)
    : undefined;

  symbol_table[symbol_table.length - 1]!.set(name, { kind: "var", type });

  return init ? { kind: "VarDecl", type, name, init } : { kind: "VarDecl", type, name };
}


export function next_stmt_node(return_type: _type, block_depth: number, symbol_table: Map<string, Symbol>[], depth: number): Node {
  if (block_depth === 0 && depth < max_depth) {
    let stmts: Node[] = [];

    for (let i = 0; i < Math.floor(Math.random() * max_block_stmts); ++i) {
      stmts.push(next_stmt_node(return_type, block_depth + 1, symbol_table, depth + 1))
    } 

    return { kind: "Block", stmts: stmts };
  }


  let candidates: (() => Node)[] = [];

  candidates.push(() => next_vardecl_node(symbol_table, depth));

  return candidates[Math.floor(Math.random() * candidates.length)]!();
}