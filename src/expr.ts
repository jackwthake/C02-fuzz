import type { _type } from './types.js'
import { narrower_same_signedness, is_type_compatible, random_scalar_type } from './types.js'

import type { Node } from './ast.js'
import { op } from './ast.js';

import type { Symbol } from './scope.js'

import { max_depth, max_ptr_depth } from './const.js'


const binop_ops: op[] = [
  op.OP_PLUS, 
  op.OP_MINUS, 
  op.OP_MULTIPLY, 
  op.OP_DIVIDE, 
  op.OP_MODULUS,
  op.OP_LT, 
  op.OP_GT, 
  op.OP_LTE, 
  op.OP_GTE,
  op.OP_EQUALSEQUALS, 
  op.OP_BANGEQUALS,
  op.OP_LEFT_SHIFT, 
  op.OP_RIGHT_SHIFT,
  op.OP_BAND, 
  op.OP_BXOR, 
  op.OP_BOR,
];


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

function expr_literal(target_type: _type): Node {
  if (target_type.ptr_depth === 1 && target_type.kind === "u8") {
    return Math.random() < 0.5 ? next_integer_literal(target_type) : next_string_literal(target_type, 10);
  } else {
    return next_integer_literal(target_type);
  }
}


function next_binop_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  const operation = binop_ops[Math.floor(Math.random() * binop_ops.length)]!;

  const other_candidates = narrower_same_signedness(target_type.kind);
  const other_type = other_candidates[Math.floor(Math.random() * other_candidates.length)]!;

  // decide which side is forced to be exactly target_type (so its width wins
  // the SPEC.md §6.3 widening rule) and which side gets the (maybe-narrower)
  // other_type
  const target_is_left = Math.random() < 0.5;
  const left_type = target_is_left ? target_type : other_type;
  const right_type = target_is_left ? other_type : target_type;

  // single choke point for building an operand - once Cast generation
  // exists, this is the one place that'd sometimes wrap the result instead
  // of returning it plain
  const build_operand = (t: _type): Node => next_expr_node(t, symbol_table, depth + 1);

  return { kind: "BinOp", op: operation, left: build_operand(left_type), right: build_operand(right_type) };
}


// picks an independent scalar source type from target type, generates a cast
function next_cast_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  const source_type = random_scalar_type();
  return { kind: "Cast", type: target_type, expr: next_expr_node(source_type, symbol_table, depth + 1) };
}


// dereferences *target_type to target_type
function next_deref_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  const ptr_type: _type = { ...target_type, ptr_depth: target_type.ptr_depth + 1 };
  return { kind: "Deref", expr: next_expr_node(ptr_type, symbol_table, depth + 1) };
}


export function next_expr_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
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

  if (target_type.ptr_depth === 0 && target_type.kind !== "struct" && target_type.kind !== "void") {
    candidates.push(() => next_binop_node(target_type, symbol_table, depth));
  }

  if (target_type.ptr_depth !== 0 || target_type.kind !== "struct") {
    candidates.push(() => next_cast_node(target_type, symbol_table, depth));
  }

  if (target_type.ptr_depth < max_ptr_depth && !(target_type.kind === "void" && target_type.ptr_depth === 0)) {
    candidates.push(() => next_deref_node(target_type, symbol_table, depth));
  }

  // pick random candidate or generate a literal if none available
  if (candidates.length > 0 && Math.random() < 0.5) {
    return candidates[Math.floor(Math.random() * candidates.length)]!();
  }

  return expr_literal(target_type); // this will break as soon as structs are added to generation
}
