# Tanneurs Bakery

A small bakery showcase site, built only with Loopress resources: no custom plugin, no code typed in wp-admin. It stands in for a real production site in the Claude Code video (`video/videos/claude-code-local-workflow/`), and shows that a Loopress project reproduces a whole site on any environment.

| Resource | Where |
|----------|-------|
| Pages (home, our breads, about, visit us) | `pages/` |
| Page template, header and footer | `theme/templates/`, `theme/parts/` |
| Theme CSS, hero photos | `theme/css/`, `theme/img/` |
| Global Styles (palette, Vollkorn + Manrope) | `theme/twentytwentyfive-loopress-global-styles.json` |
| ACF, pinned | `loopress.json` (`plugins`) |
| `product` post type and `product_category` taxonomy | `cpt/`, `taxonomies/` |
| Product fields (price, weight) | `acf/field-groups/` |
| Site title, tagline, hours and phone (`bakery_info`) | `options/` |
| `[bakery_products]` cards, used by the home and "our breads" pages | `hooks/products.php` |
| `[bakery_hours]` and `[bakery_phone]`, used by the pages and the footer | `hooks/bakery-info.php` |

Loopress ships configuration and code, not content. The products themselves (posts, categories, photos) live in `content/` and are seeded once per site with `content/seed.py`.

## Deploy it on a site

On a block theme site (Twenty Twenty-Five) with Loopress Full:

```bash
lps push                 # plugins, post types, ACF, hooks, pages, templates, parts, theme CSS, options
lps theme style push     # Global Styles, not part of `lps push`
python3 content/seed.py https://site.example admin "<application password>" [ca-file]
```

Then activate the child theme **Twenty Twenty-Five Loopress** once in Appearance > Themes (Loopress never switches the active theme), and push again. The seed is idempotent: it skips products and categories that already exist.

## Photos

All from Wikimedia Commons, public domain or CC0: no attribution required, credited here anyway.

| File | Source |
|------|--------|
| `content/images/baguette.jpg` | [Baguette-246424.jpg](https://commons.wikimedia.org/wiki/File:Baguette-246424.jpg) |
| `content/images/country-sourdough.jpg`, `theme/img/country-sourdough.jpg` | [Loaf of sourdough bread cooling.jpg](https://commons.wikimedia.org/wiki/File:Loaf_of_sourdough_bread_cooling.jpg) |
| `content/images/seeded-sourdough.jpg`, `theme/img/seeded-sourdough.jpg` | [Dutch Oven Sourdough Bread 2.jpg](https://commons.wikimedia.org/wiki/File:Dutch_Oven_Sourdough_Bread_2.jpg) |
| `content/images/croissant.jpg` (cropped) | [Croissant with jam and butter - Little Miss Piggies.jpg](https://commons.wikimedia.org/wiki/File:Croissant_with_jam_and_butter_-_Little_Miss_Piggies.jpg) |
| `content/images/pain-au-chocolat.jpg` | [Pain au chocolat - Julien Plumart 2026-08-14.jpg](https://commons.wikimedia.org/wiki/File:Pain_au_chocolat_-_Julien_Plumart_2026-08-14.jpg) |
| `content/images/twice-baked-croissant.jpg` | [Cinnamon bun - Black Mocha 2024-01-08.jpg](https://commons.wikimedia.org/wiki/File:Cinnamon_bun_-_Black_Mocha_2024-01-08.jpg) |
| `content/images/babka.jpg` | [Cinnamon Roll - Olea 2025-07-03.jpg](https://commons.wikimedia.org/wiki/File:Cinnamon_Roll_-_Olea_2025-07-03.jpg) |
| `content/images/fruit-tarts.jpg` | [Fruit custard tarts.jpg](https://commons.wikimedia.org/wiki/File:Fruit_custard_tarts.jpg) |
