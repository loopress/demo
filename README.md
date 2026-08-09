# Demo

This project is a demo on how to use Loopress

## Features demoed

Every CI run (`test` and `deploy` jobs, GitHub and GitLab alike) boots a real, disposable
WordPress instance via `loopress/setup-ci` and pushes this repo's content to it with the real
`lps` CLI, in this order:

| Command | Source in this repo | Notes |
|---|---|---|
| `lps plugin push` | `loopress.json` `plugins` | Installs/activates `wpforms-lite` so `form push` below has something to write to. `plugin-check` demonstrates a plain WordPress.org plugin under Loopress management. |
| `lps snippet push` | `snippets/` | PHP/CSS/JS/HTML/text snippets, WPCode-backed on this instance. |
| `lps api push` | `api/`, `lib/` | Custom REST routes: a plain `GET` with the default `manage_options` permission (`hello.php`), a public `permission()` override with CORS `headers()` for a headless caller (`newsletter-signup.php`), one (`prices-in-currency.php`) enriching the `price` ACF field from `acf/field-groups/group_demo_pricing.json` with a live rate from an external currency API through `guzzlehttp/guzzle`. `invoice-pdf/[order_id].php` shows a dynamic path segment rendering a real PDF with `dompdf/dompdf`, raw binary output instead of the usual JSON (headers set and echoed directly, since WordPress always JSON-encodes a normal route return value). `orders-export.php` turns the same priced pages into a downloadable `.xlsx` with `phpoffice/phpspreadsheet`, standing in for the [WooCommerce-orders cookbook recipe](https://docs.loopress.dev/cookbook/documents-and-files/spreadsheet-export-phpspreadsheet-wordpress-rest-api/) it mirrors without pulling WooCommerce into this demo. `webhook.php` uses `#[Permission]` for per-verb authorization (a public health-check `get()`, a signed `post()`). `orders/[order_id]/items/[item_id].php` combines two dynamic segments with a `#[Permission]` callback shared from `lib/ApiKeyGuard.php`. `WITH_MAJ_ENDPOINT.php` is deliberately invalid (uppercase filename), meant to demonstrate the client-side filename check rejecting it before any network call. No page in this demo actually sets a price, so `prices-in-currency.php`'s response and `orders-export.php`'s spreadsheet are both well-formed but empty, the point is the external call and the Composer/API pairing, not seeded content. |
| `lps acf push` | `acf/` | A field group, a post type, and a taxonomy. Options pages aren't included: they require ACF PRO, and this CI instance only has ACF free. |
| `lps composer push` | `composer.json` | Installs `hello-dolly` from wpackagist (a WordPress plugin, visible under `wp-content/plugins/` afterward), `guzzlehttp/guzzle` (`use`d by `api/prices-in-currency.php`), `dompdf/dompdf` (`use`d by `api/invoice-pdf/[order_id].php`), and `phpoffice/phpspreadsheet` (`use`d by `api/orders-export.php`). |
| `lps form push` | `forms/` | A WPForms contact form. |

`seo/` is included as a **reference example only**, not pushed by CI: `setup-ci` activates both
RankMath and Yoast at once (on purpose, so the Loopress plugin's own test suite can exercise the
conflict), and `lps seo` correctly refuses to guess which one is authoritative when more than one
SEO plugin is active. A real site normally runs exactly one SEO plugin, and `lps seo push` there
works the same way as every other command above.

Not demoed here: `lps login` / `lps project push` / `lps project pull` / `lps snippet publish` -
these link a project to a Loopress account through an interactive browser OAuth flow, which
doesn't fit a headless CI run (see `e2e/README.md`'s "Why seeding, not real login" for the same
reasoning applied to the CLI's own end-to-end suite).

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
