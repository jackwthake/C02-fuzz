import type { _type } from './types.js'

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
export { op };


// AST node types for the C02 language
export type Node =
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
