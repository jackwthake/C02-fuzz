import type { _type } from "./types.js";
import type { Symbol } from "./scope.js";

import { next_stmt_node } from './stmt.js';


function main(): void {
  // initialize with a non-sparse array so symbol_table[0] is definitely defined
  let symbol_table: Map<string, Symbol>[] = [new Map<string, Symbol>()];
  
  for (let i = 0; i < 10; ++i) {
    let t: _type = {  kind: "u8", ptr_depth: 0 };
    let node = next_stmt_node(t, 0, symbol_table, 0);
    console.log(`Random statement:`, node);
  }

  process.exit(0); // Exit with success code
}

main();