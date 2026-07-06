import type { _type } from './types.js'

import type { Node } from './ast.js'


function print_type(type: _type): string {
  const base = type.kind === "struct" ? type.name : type.kind;
  return base + '*'.repeat(type.ptr_depth);
}


const INDENT_UNIT = "  ";

function indent_str(indent: number): string {
  return INDENT_UNIT.repeat(indent);
}


// Prints a Node back to c02 source text. Every operand of every operator is
// wrapped in its own parens, with no attempt to reconstruct minimal parens
// from SPEC.md §6.1's precedence table - that table has sharp, documented
// edges (§6.6: a Cast's operand parses at logical_or precedence, not unary,
// so an unparenthesized Cast embedded in a wider expression can silently
// swallow more than intended once reparsed). Always-parenthesize sidesteps
// needing to get precedence exactly right by hand. Every printed piece is
// joined with a single space for the same reason at the token level - e.g.
// a type keyword printed directly against a following identifier would glue
// into one identifier token instead of two.
export function print_node(node: Node, indent: number = 0): string {
  switch (node.kind) {
    case "IntLit":
      return String(node.value);

    case "StrLit":
      // next_string_literal only ever emits plain lowercase letters today,
      // so no escaping is needed yet - revisit if that generator changes.
      return `"${node.value}"`;

    case "Identifier":
      return node.name;

    case "BinOp":
      return `(${print_node(node.left)} ${node.op} ${print_node(node.right)})`;

    case "UnOp":
      return `(${node.op} (${print_node(node.expr)}))`;

    case "Call":
      return `${node.name}(${node.args.map(print_node).join(", ")})`;

    case "Deref":
      return `(* (${print_node(node.expr)}))`;

    case "Cast":
      return `((${print_type(node.type)}) (${print_node(node.expr)}))`;

    case "VarDecl":
      return node.init
        ? `${indent_str(indent)}${print_type(node.type)} ${node.name} = ${print_node(node.init)};\n`
        : `${indent_str(indent)}${print_type(node.type)} ${node.name};\n`;

    case "Block": {
      const stmts = node.stmts.map(s => print_node(s, indent + 1)).join("");
      return `{\n${stmts}${indent_str(indent)}}`;
    }

    case "Func": {
      const params = node.params.map(p => `${print_type(p.type)} ${p.name}`).join(", ");
      const interrupt = node.is_interrupt ? " interrupt" : "";
      return `fn ${node.name}(${params})${interrupt} -> ${print_type(node.returnType)} ${print_node(node.body, indent)}`;
    }

    case "Program":
      return node.body.map(n => print_node(n, indent)).join("\n\n");
    
    case "Return": {
      if (node.value)
        return `${indent_str(indent)}return ${print_node(node.value, 0)};\n`;

      return `${indent_str(indent)}return;\n`;
    }

    case "StructInit":
    case "Assign":
    case "Break":
    case "Continue":
    case "If":
    case "While":
    case "For":
    case "RegDecl":
    case "GlobalVar":
    case "FwdDecl":
    case "StructDecl":
    case "StructFieldAccess":
      throw new Error(`print_node: '${node.kind}' not implemented yet`);

    default: {
      const _exhaustive: never = node;
      throw new Error(`print_node: unhandled node kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
