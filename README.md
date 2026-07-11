# Demo

This project is a demo on how to use Loopress

## CI

- Gitlab : [![pipeline status](https://gitlab.com/jean-smaug/loopress-demo/badges/master/pipeline.svg)](https://gitlab.com/jean-smaug/loopress-demo/-/commits/master)

## E2E tests

`tests/e2e/` uses [`@wordpress/e2e-test-utils-playwright`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-e2e-test-utils-playwright/)
to check that the WordPress admin loads against a real instance. It runs in
`.github/workflows/e2e.yml` via `loopress/setup-ci`.

To run locally: boot WordPress with `loopress/setup-ci`, then set `WP_BASE_URL`, `WP_USERNAME`,
and `WP_PASSWORD` if your instance doesn't match the `loopress/setup-ci` defaults
(`http://localhost:8080`, `admin`/`admin`), then:

```bash
npm install
npm run test:e2e
```
