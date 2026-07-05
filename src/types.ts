import type { Symbol } from './scope.js'
import { is_struct_defined } from './scope.js'
import { max_depth, max_ptr_depth } from './const.js'

// valid types for the C02 language
export type _type =
  | { kind: "u8"; ptr_depth: number }     // ptr_depth === 0 means it's a normal u8
  | { kind: "i8"; ptr_depth: number }
  | { kind: "u16"; ptr_depth: number }
  | { kind: "i16"; ptr_depth: number }
  | { kind: "void"; ptr_depth: number }
  | { kind: "struct"; name: string; ptr_depth: number };


// for types with a returned ptr value, the responsibility is on caller to check
// if theres a symbol to point to or if that should be null.
export function next_type(symbol_table: Map<string, Symbol>[], is_bare_void_allowed: boolean, depth: number): _type {
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
export function is_type_compatible(expected: _type, actual: _type): boolean {
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


const scalar_kinds: _type["kind"][] = ["u8", "i8", "u16", "i16"];


// A source type for a Cast, chosen independently of the destination - per
// SPEC.md §3.3 an explicit cast has no relatedness check against its source
// at all, so this is deliberately free to land on a different kind/width/
// signedness than target_type (that mismatch is the interesting case for
// differential testing - an identity cast never exercises the narrowing/
// sign-reinterpretation rules).
export function random_scalar_type(): _type {
  const kind = scalar_kinds[Math.floor(Math.random() * scalar_kinds.length)]!;
  return { kind, ptr_depth: 0 } as _type;
}


// Scalar kinds that are same-signedness-as and no-wider-than `kind` - the
// legal types for the "other" operand in the general widening set (SPEC.md
// §6.3): the wider side (== target_type) determines the BinOp's result type,
// so the narrower side just needs to widen into it without a signedness clash.
export function narrower_same_signedness(kind: _type["kind"]): _type[] {
  return scalar_kinds
    .filter(k => signedness(k) === signedness(kind) && width(k) <= width(kind))
    .map(k => ({ kind: k, ptr_depth: 0 } as _type));
}
