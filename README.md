# C02-fuzz

[![main](https://github.com/jackwthake/C02-fuzz/actions/workflows/main.yml/badge.svg)](https://github.com/jackwthake/C02-fuzz/actions/workflows/main.yml)
 [![lint](https://github.com/jackwthake/C02-fuzz/actions/workflows/lint.yml/badge.svg)](https://github.com/jackwthake/C02-fuzz/actions/workflows/lint.yml)
 [![docs](https://github.com/jackwthake/C02-fuzz/actions/workflows/docs.yml/badge.svg)](https://github.com/jackwthake/C02-fuzz/actions/workflows/docs.yml)

Differential testing for the [C02](https://github.com/jackwthake/C02) language.

A random program generator produces c02 source; each program is run two
ways and the results are compared:

1. **Interpreted** — a tree-walk interpreter of c02 directly.
2. **Compiled** — `cc02` compiles the same source to a 65C02 ROM, executed
   in the [py65](https://github.com/mnaberez/py65) emulator (same harness
   upstream's `emu_test.py` uses).

A mismatch between the two outcomes is a finding.

`SPEC.md` is the normative language reference the interpreter and the
generator are both written against. `DEVIATIONS.md` catalogs known
divergences between that spec and today's `cc02` — check it before treating
a mismatch as new.
