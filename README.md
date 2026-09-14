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
| `lps api push` | `api/`, `lib/` | Custom REST routes: a plain `GET` with the default `manage_options` permission (`hello.php`), a public `permission()` override with CORS `headers()` for a headless caller (`newsletter-signup.php`), one (`prices-in-currency.php`) enriching the `price` ACF field from `acf/field-groups/group_demo_pricing.json` with a live rate from an external currency API through `guzzlehttp/guzzle`. `webhook.php` uses `#[Permission]` for per-verb authorization (a public health-check `get()`, a signed `post()`). `orders/[order_id]/items/[item_id].php` combines two dynamic segments with a `#[Permission]` callback shared from `lib/ApiKeyGuard.php`. `WITH_MAJ_ENDPOINT.php` is deliberately invalid (uppercase filename), meant to demonstrate the client-side filename check rejecting it before any network call. No page in this demo actually sets a price, so `prices-in-currency.php`'s response is well-formed but empty, the point is the external call, not seeded content. |
| `lps acf push` | `acf/` | A field group, a post type, and a taxonomy. Options pages aren't included: they require ACF PRO, and this CI instance only has ACF free. |
| `lps composer push` | `composer.json` | Installs `hello-dolly` from wpackagist (a WordPress plugin, visible under `wp-content/plugins/` afterward) and `guzzlehttp/guzzle` (`use`d by `api/prices-in-currency.php`). |
| `lps form push` | `forms/` | A WPForms contact form. |

Two recipes are self-contained projects instead, each with its own `loopress.json` and
`composer.json`, pushed from their own directory (`cd <project> && lps ... push`) rather than
the site-wide config above (see `obsidian/Product/Cookbook Content Pipeline.md` for why):

| Project | Command | Notes |
|---|---|---|
| `post-to-pdf-dompdf-wordpress-rest-api/` | `lps composer push && lps api push` | `api/post-pdf/[post_id].php` shows a dynamic path segment rendering any published post as a downloadable PDF with `dompdf/dompdf` (fed the post's own `the_content`-filtered HTML), raw binary output instead of the usual JSON, mirroring the [post-to-PDF cookbook recipe](https://docs.loopress.dev/cookbook/documents-and-files/post-to-pdf-dompdf-wordpress-rest-api/) line for line. Post 1 ("Hello world!", WordPress's own default) is real seeded content, no stand-in needed. |
| `spreadsheet-export-phpspreadsheet-wordpress-rest-api/` | `lps composer push && lps api push` | `api/orders-export.php` turns real WooCommerce orders into a downloadable `.xlsx` with `phpoffice/phpspreadsheet`, mirroring the [spreadsheet-export cookbook recipe](https://docs.loopress.dev/cookbook/documents-and-files/spreadsheet-export-phpspreadsheet-wordpress-rest-api/). `composer.json` requires `wpackagist-plugin/woocommerce` alongside the PHP library, composer.json isn't just for pure-PHP dependencies. Composer installs WooCommerce's files but doesn't activate it, and `lps plugin push` refuses to run at all once a project has its own `composer.json` (it's authoritative for plugins there, no CLI command activates a wpackagist-installed plugin today), so activate WooCommerce in wp-admin (Plugins > Activate) same as any other WordPress plugin; CI does the REST-API equivalent (see `.github/workflows/loopress-ci.yml`). No order exists in a fresh install, so the exported file is well-formed but empty beyond its header row. |
| `instant-search-algolia-woocommerce-hooks/` | `lps composer push && lps hook push` | Two hooks instead of a route, mirroring the [instant-search-algolia cookbook recipe](https://docs.loopress.dev/cookbook/search-and-data-services/instant-search-algolia-woocommerce-hooks/): `hooks/algolia-index.php` keeps an Algolia `products` index current on `woocommerce_new_product`/`woocommerce_update_product` with `algolia/algoliasearch-client-php`, `hooks/replace-header-search.php` swaps WooCommerce's native search box for the recipe's React app via the `get_product_search_form` filter. `composer.json` requires `wpackagist-plugin/woocommerce` the same way as the spreadsheet-export recipe above, same WooCommerce-activation dance in CI. No product save happens in CI, so the hooks are deployed but never actually triggered, no Algolia credentials needed here; the recipe's `apps/algolia-search` React app isn't part of this repo, it has its own npm/vite build the site-wide config here doesn't host. |

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
