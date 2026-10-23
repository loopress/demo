<?php
declare(strict_types=1);

use Loopress\Hooks\Attribute\Action;

/**
 * [bakery_products]: product cards, from the `product` post type (cpt/product.json) and its
 * ACF fields (acf/field-groups/group_product_details.json), in menu order.
 * `category` keeps one product category (its slug), `limit` the first N products.
 */
final class BakeryProducts
{
    #[Action('init')]
    public function registerShortcode(): void
    {
        add_shortcode('bakery_products', [$this, 'render']);
    }

    public function render(array|string $atts = []): string
    {
        $atts = shortcode_atts(['category' => '', 'limit' => -1], $atts);
        $query = [
            'post_type' => 'product',
            'posts_per_page' => (int) $atts['limit'],
            'orderby' => 'menu_order',
            'order' => 'ASC',
            'no_found_rows' => true,
        ];
        if ($atts['category'] !== '') {
            $query['tax_query'] = [['taxonomy' => 'product_category', 'field' => 'slug', 'terms' => $atts['category']]];
        }

        $cards = array_map([$this, 'card'], get_posts($query));

        return '<div class="c-products">' . implode('', $cards) . '</div>';
    }

    private function card(WP_Post $product): string
    {
        $price = (float) get_field('price', $product->ID);
        $weight = (string) get_field('weight', $product->ID);

        return '<article class="c-product">'
            . '<div class="c-product__photo">' . get_the_post_thumbnail($product, 'large') . '</div>'
            . '<div class="c-product__body">'
            . '<h3>' . esc_html(get_the_title($product)) . '</h3>'
            . '<p>' . esc_html(get_the_excerpt($product)) . '</p>'
            . '<p class="c-price">&euro;' . number_format($price, 2)
            . ($weight !== '' ? ' <span>' . esc_html($weight) . '</span>' : '')
            . '</p>'
            . '</div>'
            . '</article>';
    }
}
