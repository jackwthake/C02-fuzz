import type { _type } from './types.js'

// Symbol table entry types for the C02 language
export type Symbol =
  | { kind: "var"; type: _type }
  | { kind: "func"; params: _type[]; returnType: _type }
  | { kind: "struct"; fields: { name: string; type: _type }[] };


// Search for a symbol in the symbol table stack
export function lookup(scopes: Map<string, Symbol>[], name: string): Symbol | undefined {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const sym = scopes[i]?.get(name);
    if (sym) return sym;
  }
  return undefined;
}


// is there a struct defined in the current scope stack?
// this is used to determine if we can generate a pointer to a struct
export function is_struct_defined(scopes: Map<string, Symbol>[]): string | undefined {
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
