<?php

declare(strict_types=1);

use Loopress\Hooks\Attribute\Filter;

// get_product_search_form() is the one filter both Storefront's header and
// WooCommerce's own search widgets route their final HTML through (see
// wc-template-functions.php), so hooking it here swaps every one of them at
// once, not just the header. A #[Filter] must return the (possibly modified)
// value it receives, the shortcode's own markup replaces it outright.
class ReplaceHeaderSearch
{
    #[Filter('get_product_search_form')]
    public function withAlgoliaSearch(string $form): string
    {
        return do_shortcode('[loopress_app name="algolia-search"]');
    }
}
