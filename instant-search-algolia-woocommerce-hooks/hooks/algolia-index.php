<?php

declare(strict_types=1);

use Loopress\Hooks\Attribute\Action;
use Algolia\AlgoliaSearch\Api\SearchClient;

// Two hooks, not one: a brand-new product fires woocommerce_new_product, never
// woocommerce_update_product (that one's update-only). Both run after
// WC_Product::save() finishes, unlike save_post_product, which fires mid-save,
// before WooCommerce's own meta box has written price/stock, so wc_get_product()
// there could still read the previous values.
class AlgoliaIndex
{
    #[Action('woocommerce_new_product')]
    public function onCreate(int $productId): void
    {
        $this->index($productId);
    }

    #[Action('woocommerce_update_product')]
    public function onUpdate(int $productId): void
    {
        $this->index($productId);
    }

    private function index(int $productId): void
    {
        $product = wc_get_product($productId);

        if (!$product instanceof WC_Product || $product->get_status() !== 'publish') {
            return;
        }

        $client = SearchClient::create(
            (string) get_option('algolia_app_id'),
            (string) get_option('algolia_write_key')
        );

        $categories = wc_get_product_terms($productId, 'product_cat', ['fields' => 'names']);

        $client->saveObject('products', [
            'objectID' => (string) $productId,
            'title' => $product->get_name(),
            'price' => (float) $product->get_regular_price(),
            'category' => $categories[0] ?? null,
        ]);
    }
}
