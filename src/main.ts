import type { _type } from "./types.js";
import type { Node } from "./ast.js";
import type { Symbol } from "./scope.js";

import { next_expr_node } from './expr.js';


function main(): void {
  // initialize with a non-sparse array so symbol_table[0] is definitely defined
  let symbol_table: Map<string, Symbol>[] = [new Map<string, Symbol>()];
  
  let node: Node;

  symbol_table[0]!.set("x", { kind: "var", type: { kind: "u8", ptr_depth: 0 } });
  symbol_table[0]!.set("y", { kind: "var", type: { kind: "u8", ptr_depth: 1 } });
  symbol_table[0]!.set("test", { kind: "func", returnType : { kind: "u8", ptr_depth: 0 }, params: [ { kind: "u8", ptr_depth: 0 } ] });
  
  do {
    let t: _type = {  kind: "u8", ptr_depth: 0 };
    node = next_expr_node(t, symbol_table, 0);
    console.log(`Random expression:`, node);
  } while (node.kind !== "Deref")

  process.exit(0); // Exit with success code
}

main();