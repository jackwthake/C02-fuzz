// valid types for the C02 language
type _type =
  | { kind: "u8"; ptr_depth: number }     // ptr_depth === 0 means it's a normal u8
  | { kind: "i8"; ptr_depth: number }
  | { kind: "u16"; ptr_depth: number }
  | { kind: "i16"; ptr_depth: number }
  | { kind: "void"; ptr_depth: number }
  | { kind: "struct"; name: string; ptr_depth: number };


// valid operators for the C02 language
enum op {
  OP_INCREMENT = "++", 
  OP_DECREMENT = "--", 
  OP_PLUS = "+", 
  OP_MINUS = "-", 
  OP_MULTIPLY = "*", 
  OP_DIVIDE = "/", 
  OP_MODULUS = "%",

  OP_LT = "<", 
  OP_GT = ">", 
  OP_LTE = "<=", 
  OP_GTE = ">=",
  OP_EQUALSEQUALS = "==", 
  OP_BANGEQUALS = "!=",
  OP_AND = "&&", 
  OP_OR = "||",
  OP_BANG = "!", 
  
  OP_NEGATE = "-", 
  OP_ADDRESSOF = "&", 

  OP_LEFT_SHIFT = "<<", 
  OP_RIGHT_SHIFT = ">>",
  OP_BAND = "&", 
  OP_BXOR = "^", 
  OP_BOR = "|", 
  OP_BNOT = "~"
}


// AST node types for the C02 language
type Node =
        // Literals
        | { kind: "IntLit"; value: number; type: _type }
        | { kind: "StrLit"; value: string; }
        | { kind: "Identifier"; name: string; type: _type }

        // Expressions
        | { kind: "BinOp"; op: op; left: Node; right: Node }
        | { kind: "UnOp"; op: op; expr: Node }
        | { kind: "Call"; name: string; args: Node[]; returnType: _type }
        | { kind: "Deref"; expr: Node }
        | { kind: "Cast"; expr: Node; type: _type }

        // Statements
        | { kind: "VarDecl"; type: _type; name: string; init?: Node }
        | { kind: "StructInit"; struct: string; fields: { name: string; value: Node }[] }
        | { kind: "Assign"; target: Node; value: Node }
        | { kind: "Return"; value?: Node }
        | { kind: "Break" }
        | { kind: "Continue" }
//      | { kind: "AsmBlock"; mnemonics: string[] } asm blocks aren't really in the scope of this, were verifying the language features specifically
        | { kind: "If"; cond: Node; then: Node; else?: Node }
        | { kind: "While"; cond: Node; body?: Node }
        | { kind: "For"; init?: Node; cond?: Node; incr?: Node; body?: Node }
        | { kind: "Block"; stmts: Node[] }

        // Top-level nodes
        | { kind: "Func"; name: string; params: { type: _type; name: string }[]; body: Node; returnType: _type; is_interrupt: boolean }
        | { kind: "RegDecl"; type: _type; name: string; address: number; }
        | { kind: "GlobalVar"; type: _type; name: string; init?: Node }
        | { kind: "FwdDecl"; name: string; type: _type; isFunc: boolean; is_interrupt?: boolean; params?: _type[] }
        
        | { kind: "StructDecl"; name: string; fields: { name: string; type: _type }[] }
        | { kind: "StructFieldAccess"; struct: Node; field: string }
        
        // The root node of the AST
        | { kind: "Program"; body: Node[] };


// Symbol table entry types for the C02 language
type Symbol =
  | { kind: "var"; type: _type }
  | { kind: "func"; params: _type[]; returnType: _type }
  | { kind: "struct"; fields: { name: string; type: _type }[] };


var max_depth = 3; // maximum depth for nested expressions/statements
var max_top_levels = 3; // maximum number of top-level nodes in the AST
var max_ptr_depth = 2; // maximum pointer depth for types


// Search for a symbol in the symbol table stack
function lookup(scopes: Map<string, Symbol>[], name: string): Symbol | undefined {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const sym = scopes[i]?.get(name);
    if (sym) return sym;
  }
  return undefined;
}


// is there a struct defined in the current scope stack?
// this is used to determine if we can generate a pointer to a struct
function is_struct_defined(scopes: Map<string, Symbol>[]): string | undefined {
  const names: string[] = [];

  for (const scope of scopes) {
    for (const [name, sym] of scope.entries()) {
      if (sym.kind === "struct") {
        names.push(name);
      }
    }
  }

  if (names.length === 0) return undefined;
  return names[Math.floor(Math.random() * names.length)];
}


// for types with a returned ptr value, the responsibility is on caller to check
// if theres a symbol to point to or if that should be null.
function next_type(symbol_table: Map<string, Symbol>[], is_bare_void_allowed: boolean, depth: number): _type {
  let is_ptr = Math.random() < 0.5; // 50% chance to be a pointer
  let ptr_depth = is_ptr ? Math.floor(Math.random() * max_ptr_depth + 1) : 0;

  const types: _type[] = [
    { kind: "u8", ptr_depth },
    { kind: "i8", ptr_depth },
    { kind: "u16", ptr_depth },
    { kind: "i16", ptr_depth },
  ];

  if (is_ptr) {
    types.push({ kind: "void", ptr_depth });
  }

  // void is only allowed as a return type
  if (is_bare_void_allowed) {
    types.push({ kind: "void", ptr_depth: 0 });
  }

  // If we are not at max depth, we can also choose a struct type
  if (depth < max_depth) {
    let name = is_struct_defined(symbol_table);
    if (name) {
      types.push({ kind: "struct", name, ptr_depth });
    }
  }

  // Randomly select a type from the available options
  const index = Math.floor(Math.random() * types.length);
  return types[index]!;
}


function next_integer_literal(type: _type): Node {
  let value: number;

  if (type.ptr_depth > 0) {
    value = 0; // null ptr is only valid literal for pointer types
  } else {
    switch (type.kind) {
      case "u8":
        value = Math.floor(Math.random() * 256); // 0 to 255
        break;
      case "i8":
        value = Math.floor(Math.random() * 256) - 128; // -128 to 127
        break;
      case "u16":
        value = Math.floor(Math.random() * 65536); // 0 to 65535
        break;
      case "i16":
        value = Math.floor(Math.random() * 65536) - 32768; // -32768 to 32767
        break;
      default:
        throw new Error(`Unhandled type: ${type.kind}`);
    }
  }

  return { kind: "IntLit", value, type };
}


function next_string_literal(type: _type, max_length: number): Node {
  if (type.kind !== "u8" || type.ptr_depth !== 1) {
    throw new Error("Cannot generate string literal for non-pointer u8 type");
  }

  let value = "";
  for (let i = 0; i < max_length; i++) {
    value += String.fromCharCode(Math.floor(Math.random() * 26) + 97); // random lowercase letter
  }
  
  return { kind: "StrLit", value }; // assuming string is a pointer to u8
}


// Width in bytes of a scalar kind (SPEC.md §3.2 rule 8). Only ever called
// once rule 7 has ruled out "struct"/"void", so u8/i8/u16/i16 is exhaustive.
function width(kind: _type["kind"]): number {
  switch (kind) {
    case "u8":
    case "i8":
      return 1;
    case "u16":
    case "i16":
      return 2;
    default:
      throw new Error(`width() called on non-scalar kind: ${kind}`);
  }
}


// Signedness of a scalar kind (SPEC.md §3.2 rule 8). Same exhaustiveness
// assumption as width() above.
function signedness(kind: _type["kind"]): "signed" | "unsigned" {
  switch (kind) {
    case "u8":
    case "u16":
      return "unsigned";
    case "i8":
    case "i16":
      return "signed";
    default:
      throw new Error(`signedness() called on non-scalar kind: ${kind}`);
  }
}


// Implements SPEC.md §3.2 is_types_compatible, rules 2-8, in order - the
// ordering is load-bearing (see rules 2<7, 5<6<7 dependencies discussed
// while designing this). Rule 1 (bare literal `0` compatible with any
// pointer target) isn't here: it depends on the literal's *value*, not on
// two _types, so it's implemented in next_integer_literal instead.
function is_type_compatible(expected: _type, actual: _type): boolean {
  // Rule 2: void* accepts any pointee kind, but only at matching ptr_depth
  // (S-18 - cc02 itself ignores depth here, we don't).
  if (expected.kind === "void" && expected.ptr_depth === 1 && actual.ptr_depth === 1) {
    return true;
  }

  // Rule 3: pointer-ness must agree - one side a pointer and the other not
  // is never compatible.
  if ((expected.ptr_depth > 0) !== (actual.ptr_depth > 0)) {
    return false;
  }

  // Rule 4: both pointers, but depths differ (e.g. u8* vs u8**).
  if (expected.ptr_depth !== actual.ptr_depth) {
    return false;
  }

  // Rule 5: two structs are only compatible if their names match exactly -
  // must run before rule 6, or any two same-kind structs would "match"
  // regardless of name.
  if (expected.kind === "struct" && actual.kind === "struct") {
    return expected.name === actual.name;
  }

  // Rule 6: exact kind match (covers void<->void and any scalar<->itself).
  // Must run before rule 7, or e.g. void<->void would be wrongly rejected.
  if (expected.kind === actual.kind) {
    return true;
  }

  // Rule 7: a struct or void on either side, with no match above, is never
  // compatible with anything else.
  if (expected.kind === "struct" || expected.kind === "void" ||
      actual.kind === "struct" || actual.kind === "void") {
    return false;
  }

  // Rule 8: only two distinct scalar kinds can reach here. If both sides
  // are still pointers (same depth, mismatched pointee kind), reject -
  // there is no pointee-widening between pointer types (S-19).
  if (expected.ptr_depth !== 0 || actual.ptr_depth !== 0) {
    return false;
  }

  // Rule 8, non-pointer case: compatible iff signedness matches and
  // `actual` fits within `expected`'s width (implicit widening only).
  return signedness(actual.kind) === signedness(expected.kind)
      && width(actual.kind) <= width(expected.kind);
}


function expr_literal(target_type: _type): Node {
  if (target_type.ptr_depth === 1 && target_type.kind === "u8") {
    return Math.random() < 0.5 ? next_integer_literal(target_type) : next_string_literal(target_type, 10);
  } else {
    return next_integer_literal(target_type);
  }
} 


function next_expr_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  if (depth >= max_depth) {
    return expr_literal(target_type);
  }

  // prescan collect whats available in the symbol table for this type -
  // candidates are thunks, not built Nodes, so a Call's args are only ever
  // recursively generated for the one candidate that actually gets picked.
  let candidates: (() => Node)[] = [];

  for (const scope of symbol_table) {
    for (const [name, sym] of scope.entries()) {
      if (sym.kind === "var" && is_type_compatible(target_type, sym.type)) {
        candidates.push(() => ({ kind: "Identifier", name, type: sym.type }));
      }

      if (sym.kind === "func" && is_type_compatible(target_type, sym.returnType)) {
        candidates.push(() => {
          const args = sym.params.map(paramType => next_expr_node(paramType, symbol_table, depth + 1));
          return { kind: "Call", name, args, returnType: sym.returnType };
        });
      }
    }
  }

  // pick random candidate or generate a literal if none available
  if (candidates.length > 0 && Math.random() < 0.5) {
    return candidates[Math.floor(Math.random() * candidates.length)]!();
  }

  return expr_literal(target_type); // this will break as soon as structs are added to generation
}


function next_stmt_node(_program: Node, _symbol_table: Map<string, Symbol>[], _depth: number): Node {
  return { kind: "Break" }; // Placeholder implementation
}


function next_top_level_node(_program: Node, _symbol_table: Map<string, Symbol>[], _depth: number): Node {
  let node: Node = { kind: "RegDecl", type: { kind: "u8", ptr_depth: 0 }, name: "reg1", address: 0 };

  return node;
}


// Function to generate a random AST for testing
function generate_ast(): Node {
  let symbol_table : Map<string, Symbol>[] = [];
  let program: Node = { kind: "Program", body: [] };

  // push top level scope
  symbol_table.push(new Map<string, Symbol>());

  for (let i = 0; i < max_top_levels; i++) {
    const node = next_top_level_node(program, symbol_table, i);
    if (node) {
      program.body.push(node);
    }
  }

  return program;
}


// Function to evaluate the AST and return a number
function evaluate(_node: Node, _env: Record<string, number>): number {
  return 0; // Placeholder implementation
}


// Function to convert AST to string representation
// this will be saved and passed to the C02 compiler for comparison
function ast_to_string(node: Node): string {
  let src = "";

  return src;
}


function main(): void {
  // initialize with a non-sparse array so symbol_table[0] is definitely defined
  let symbol_table: Map<string, Symbol>[] = [new Map<string, Symbol>()];
  
  let node: Node;

  symbol_table[0].set("x", { kind: "var", type: { kind: "u8", ptr_depth: 0 } });
  symbol_table[0].set("test", { kind: "func", returnType : { kind: "u8", ptr_depth: 0 }, params: [ { kind: "u8", ptr_depth: 0 } ] });
  
  do {
    let t: _type = {  kind: "u8", ptr_depth: 0 };
    node = next_expr_node(t, symbol_table, 0);
    console.log(`Random expression:`, node);
  } while (node.kind !== "Call")

  process.exit(0); // Exit with success code
}

main();