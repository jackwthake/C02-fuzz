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


function next_return_node(return_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  if (return_type.kind === "void" && return_type.ptr_depth === 0) {
    return { kind: "Return" };
  }

  return { kind: "Return", value: next_expr_node(return_type, symbol_table, depth + 1) };
}


export function next_stmt_node(return_type: _type, block_depth: number, symbol_table: Map<string, Symbol>[], depth: number): Node {
  if (block_depth === 0 && depth < max_depth) {
    let stmts: Node[] = [];

    let num_stmts = Math.floor(Math.random() * max_block_stmts);

    const needs_return = !(return_type.kind === "void" && return_type.ptr_depth === 0);
    // a 0-statement body would otherwise skip the forced-return check below entirely
    if (needs_return && num_stmts === 0) num_stmts = 1;

    for (let i = 0; i < num_stmts; ++i) {
      let stmt: Node;

      // if we're the last node in the body and the return type isn't bare void
      // we have to return something
      if (i === num_stmts - 1 && needs_return) {
        stmt = next_return_node(return_type, symbol_table, depth + 1);
      } else {
        stmt = next_stmt_node(return_type, block_depth + 1, symbol_table, depth + 1);
      }
      
      stmts.push(stmt);

      // no point generating more statements after a return - they'd never run
      if (stmt.kind === "Return") break;
    }

    return { kind: "Block", stmts: stmts };
  }


  let candidates: (() => Node)[] = [];

  candidates.push(() => next_vardecl_node(symbol_table, depth));
  candidates.push(() => next_return_node(return_type, symbol_table, depth + 1))

  return candidates[Math.floor(Math.random() * candidates.length)]!();
}