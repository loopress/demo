# Demo

This project is a demo on how to use Loopress

## CI

- Gitlab : [![pipeline status](https://gitlab.com/jean-smaug/loopress-demo/badges/master/pipeline.svg)](https://gitlab.com/jean-smaug/loopress-demo/-/commits/master)

## E2E tests

`tests/e2e/` exercises the `lps snippet pull`/`push` workflow, including error handling, against
a real WordPress instance. It runs in `.github/workflows/e2e.yml` via `loopress/setup-ci`.

To run locally: boot WordPress with `loopress/setup-ci` (or point `LOOPRESS_RESTORE_SCRIPT` at a
`setup-ci` checkout), install `@loopress/cli` globally so `lps` is on `PATH`, then:

```bash
npm install
npm run test:e2e
```
