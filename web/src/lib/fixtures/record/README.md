# The record the self-checks read

This is the fixture the website's self-checks run against. It is a record in the same shape as
`content/`, and `LEDGERPRESS_RECORD_ROOT` points the readers here so the tests prove the readers
work rather than asserting whose facts are in `content/`.

Two rules keep it useful:

- **It is not the adopter's record.** Nothing here is published, and nothing here is copied into a
  build. An adopter replacing `content/` never touches this directory. The name in it is the
  template's original example scholar, kept only because the assertions quote its keys and venues.
- **It is frozen, and `content/` is not.** This started as a copy of the bundled example and is
  deliberately allowed to drift from it: `content/` must be free to be replaced wholesale, which is
  the entire reason these assertions moved off it.

Add to it whenever a reader gains a shape worth proving — a `@patent` entry, a sparse citation, a
name form that initialises badly. Assertions about specific keys, counts, venues or citations belong
here and nowhere else.

The checks that must hold for _any_ valid record — the schema boundary, the consistency gate, and
the agreement between the generated PDF data and the record it came from — read the real `content/`
instead, in `src/lib/live-record.test.ts`.
