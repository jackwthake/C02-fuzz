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


// return a positive number that when passed to unary op negate will create a negative signed integer
function next_signed_integer_thats_positive(target_type: _type): Node {
  if (target_type.ptr_depth !== 0) {
    throw new Error(`Unhandled type: ${target_type.kind}`);
  }

  switch(target_type.kind) {
    case 'i8':
      return { kind: "IntLit", value: Math.floor(Math.random() * 128) + 1, type: target_type };   // 1..128
    case 'i16':
      return { kind: "IntLit", value: Math.floor(Math.random() * (32768 - 129 + 1)) + 129, type: target_type };  // 129..32768
    default:
      throw new Error(`Unhandled type: ${target_type.kind}`);
  }
}


// exact type match (kind, ptr_depth, and struct name) - unlike
// is_type_compatible, this allows no widening. Needed for &'s operand: &'s
// result type is derived directly from the operand's own declared type, not
// through a widening context, so a merely-compatible-but-narrower operand
// would silently produce the wrong pointer type.
function is_exact_type_match(a: _type, b: _type): boolean {
  if (a.ptr_depth !== b.ptr_depth) return false;
  if (a.kind === "struct" || b.kind === "struct") {
    return a.kind === "struct" && b.kind === "struct" && a.name === b.name;
  }
  return a.kind === b.kind;
}


// picks an lvalue-shaped operand (Identifier/Deref per SPEC.md §7.3, checked
// shallowly) of exactly `type` - shared by & (whose result type is derived
// directly from the operand's own declared type, no widening context) and
// ++/-- (which read-modify-write the same storage, so the operand must
// already be exactly `type`). A Deref-shaped operand is always
// constructible (bottoms out at a null-pointer literal if nothing else is
// available), so this never needs to fall back to a literal - and per
// DEVIATIONS.md P1-1/P0-4, &(*p) and ++(*p) are real cc02 bugs, which is
// exactly the kind of shape this fuzzer should keep generating, not avoid.
function next_lvalue_node(type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  let candidates: (() => Node)[] = [];

  for (const scope of symbol_table) {
    for (const [name, sym] of scope.entries()) {
      if (sym.kind === "var" && is_exact_type_match(type, sym.type)) {
        candidates.push(() => ({ kind: "Identifier", name, type: sym.type }));
      }
    }
  }

  candidates.push(() => next_deref_node(type, symbol_table, depth));

  return candidates[Math.floor(Math.random() * candidates.length)]!();
}


// address-of: target_type must be a pointer; the operand is an lvalue of
// exactly the pointee type.
function next_addressof_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  const operand_type: _type = { ...target_type, ptr_depth: target_type.ptr_depth - 1 };
  return { kind: "UnOp", op: op.OP_ADDRESSOF, expr: next_lvalue_node(operand_type, symbol_table, depth) };
}


function next_unop_node(target_type: _type, symbol_table: Map<string, Symbol>[], depth: number): Node {
  let candidates: (() => Node)[] = [];

  if (target_type.ptr_depth === 0 && target_type.kind !== "struct" && target_type.kind !== "void") {
    candidates.push(() => {
      return { kind: "UnOp", op: op.OP_BNOT, expr: next_expr_node(target_type, symbol_table, depth + 1) } as Node;
    })

    candidates.push(() => {
      return { kind: "UnOp", op: op.OP_NEGATE, expr: next_expr_node(target_type, symbol_table, depth + 1) };
    })

    // confirmed by testing (SPEC.md §6.2): unlike &&/||, ! is type-preserving,
    // not forced to u8
    candidates.push(() => {
      return { kind: "UnOp", op: op.OP_BANG, expr: next_expr_node(target_type, symbol_table, depth + 1) };
    })

    if (target_type.kind === "i8" || target_type.kind === "i16") {
      candidates.push(() => {
        return { kind: "UnOp", op: op.OP_NEGATE, expr: next_signed_integer_thats_positive(target_type) };
      })
    }
  }

  // & needs its own guard: target must be a pointer, and the operand type
  // (target_type with ptr_depth - 1) must be a constructible type - bare
  // void (ptr_depth 0) can't be an operand, since no variable can have that
  // type and Deref is likewise never allowed to produce one.
  if (target_type.ptr_depth >= 1 && !(target_type.kind === "void" && target_type.ptr_depth === 1)) {
    candidates.push(() => next_addressof_node(target_type, symbol_table, depth));
  }

  // ++/-- are type-preserving like ~/-, but unlike them pointers are fair
  // game (++ptr is fine per SPEC.md §5.8) - only struct and bare void are
  // excluded, the latter for the same reason as &'s guard above.
  if (target_type.kind !== "struct" && !(target_type.kind === "void" && target_type.ptr_depth === 0)) {
    candidates.push(() => ({ kind: "UnOp", op: op.OP_INCREMENT, expr: next_lvalue_node(target_type, symbol_table, depth) }));
    candidates.push(() => ({ kind: "UnOp", op: op.OP_DECREMENT, expr: next_lvalue_node(target_type, symbol_table, depth) }));
  }

  return candidates[Math.floor(Math.random() * candidates.length)]!();
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

  const unop_scalar_ok = target_type.ptr_depth === 0 && target_type.kind !== "struct" && target_type.kind !== "void";
  const unop_addressof_ok = target_type.ptr_depth >= 1 && !(target_type.kind === "void" && target_type.ptr_depth === 1);
  const unop_incdec_ok = target_type.kind !== "struct" && !(target_type.kind === "void" && target_type.ptr_depth === 0);
  if (unop_scalar_ok || unop_addressof_ok || unop_incdec_ok) {
    candidates.push(() => next_unop_node(target_type, symbol_table, depth));
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
