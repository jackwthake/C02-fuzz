import type { _type } from "./types.js";
import type { Symbol } from "./scope.js";
import type { Node } from "./ast.js";

import { next_stmt_node, next_fresh_name } from './stmt.js';
import { print_node } from "./print.js";

import { generated_path, max_programs, max_top_levels } from './const.js';

import * as fs from 'node:fs';


function format_run_folder_name(date: Date): string {
  // Helper function to add leading zero if needed
  const pad = (num: number): string => String(num).padStart(2, '0');

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1); // JavaScript months are 0-indexed (0 = January)
  const year = date.getFullYear();

  const hours = pad(date.getHours()); // Natively 24-hour format
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const millis = String(date.getMilliseconds()).padStart(3, '0');

  return `${day}-${month}-${year}T${hours}:${minutes}:${seconds}.${millis}`;
}


// each run gets its own subfolder so a fresh run never overwrites a
// previous run's output - prog_N counters restart at 0 every process start,
// but the timestamp keeps different runs' files apart
const run_path = `${generated_path}/run_${format_run_folder_name(new Date)}`;


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


// generates a random program and writes it to the file system
function generate_program(): string | undefined {
  let program: Node = generate_ast();
  let source: string = print_node(program); 
  let file_name: string = `${run_path}/${next_fresh_name('prog_')}.c02`;

  try {
    fs.writeFileSync(file_name, source, 'utf8');
    return file_name;
  } catch (err) {
    return undefined;
  }
}


function main(): void {
  fs.mkdirSync(run_path, { recursive: true });

  for (let i = 0; i < max_programs; ++i) {
    if (generate_program() === undefined) {
      console.log(`Failed to write program ${i + 1}! Quitting.`);
      process.exit(1); // Exit with error code
    }
  }

  process.exit(0); // Exit with success code
}

main();
