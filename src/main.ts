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
  
  OP_NEGATE = "~", 
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
        | { kind: "IntLit"; value: number; type: _type }
        | { kind: "StrLit"; value: string; }
        | { kind: "Identifier"; name: string; type: _type }

        | { kind: "BinOp"; op: op; left: Node; right: Node }
        | { kind: "UnOp"; op: op; expr: Node }
        | { kind: "Call"; name: string; args: Node[]; returnType: _type }
        | { kind: "Deref"; expr: Node }
        | { kind: "Cast"; expr: Node; type: _type }

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

        | { kind: "Func"; name: string; params: { type: _type; name: string }[]; body: Node; returnType: _type; is_interrupt: boolean }
        | { kind: "RegDecl"; type: _type; name: string; address: number; }
        | { kind: "GlobalVar"; type: _type; name: string; init?: Node }
        | { kind: "FwdDecl"; name: string; type: _type; isFunc: boolean; is_interrupt?: boolean; params?: _type[] }
        
        | { kind: "StructDecl"; name: string; fields: { name: string; type: _type }[] }
        | { kind: "StructFieldAccess"; struct: Node; field: string }
        
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


function next_expr_node(_program: Node, _symbol_table: Map<string, Symbol>[], _depth: number): Node {
  return { kind: "IntLit", value: 42, type: { kind: "u8", ptr_depth: 0 } }; // Placeholder implementation
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
  let symbol_table : Map<string, Symbol>[] = [];
  symbol_table.push(new Map<string, Symbol>());
  
  for (let i = 0; i < 5; i++) {
    console.log(`Random type ${i}:`, next_type(symbol_table, true, 0));
  }

  process.exit(0); // Exit with success code
}

main();