import type { _type } from './types.js'
import { next_type } from './types.js'

import type { Node } from './ast.js'

import type { Symbol } from './scope.js'

import { next_expr_node } from './expr.js'

import { max_depth, max_block_stmts } from './const.js'


let next_var_id = 0;

// fresh, globally-unique variable name - SPEC.md §7.2 disallows shadowing
// (not just same-scope redeclaration), checked against every enclosing
// scope up to global, so a monotonic counter sidesteps the check entirely
// rather than needing to search the whole scope stack for a free name.
function next_var_name(): string {
  return `v${next_var_id++}`;
}


function next_vardecl_node(symbol_table: Map<string, Symbol>[], depth: number): Node {
  const type = next_type(symbol_table, false, depth);
  const name = next_var_name();

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