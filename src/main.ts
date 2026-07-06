import type { _type } from "./types.js";
import type { Symbol } from "./scope.js";
import type { Node } from "./ast.js";

import { next_stmt_node, next_fresh_name } from './stmt.js';
import { print_node } from "./print.js";

import { max_top_levels } from './const.js';


function next_top_level_node(symbol_table: Map<string, Symbol>[], is_main: boolean): Node {
  let return_type: _type = { kind: "void", ptr_depth: 0 };
  let name = is_main ? "main" : next_fresh_name("f");

  // function body gets its own scope (SPEC.md §7.2) - locals shouldn't leak
  // into global or into other functions' bodies
  symbol_table.push(new Map<string, Symbol>());
  let body: Node = next_stmt_node(return_type, 0, symbol_table, 1);
  symbol_table.pop();

  return { kind: "Func", returnType: return_type, name, params: [], body: body, is_interrupt: false };
}


// Function to generate a random AST for testing
function generate_ast(): Node {
  let symbol_table: Map<string, Symbol>[] = [new Map<string, Symbol>()];
  let body: Node[] = [];

  // exactly one function must be named main (SPEC.md §7.4) - only the first
  // iteration gets that name, the rest get fresh unique ones
  for (let i = 0; i < max_top_levels; i++) {
    body.push(next_top_level_node(symbol_table, i === 0));
  }

  return { kind: "Program", body };
}


function main(): void {
  let program: Node = generate_ast();
  console.log(print_node(program));

  process.exit(0); // Exit with success code
}

main();
