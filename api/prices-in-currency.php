<?php

declare(strict_types=1);

use GuzzleHttp\Client;

// Enriches real WordPress data (the `price` ACF field on pages, see
// acf/field-groups/group_demo_pricing.json) with a live rate from an external service, using the
// guzzlehttp/guzzle package installed via Composer. This is the case a Composer HTTP client is
// actually for: WP_Query already covers anything local, Guzzle earns its place the moment the
// data has to come from outside the site. Frankfurter (ECB reference rates) needs no API key and
// no auth, so the demo stays runnable without any secret to manage in CI.
final class PricesInCurrency
{
    public function get(WP_REST_Request $request): array
    {
        $currency = strtoupper((string) ($request->get_param('currency') ?: 'EUR'));

        $client = new Client();
        $response = $client->get('https://api.frankfurter.app/latest', [
            'query' => ['from' => 'USD', 'to' => $currency],
        ]);
        $rate = json_decode((string) $response->getBody(), true)['rates'][$currency] ?? null;

        if ($rate === null) {
            return ['error' => "Unknown currency: {$currency}"];
        }

        $pages = get_posts([
            'post_type' => 'page',
            'meta_key' => 'price',
            'numberposts' => -1,
        ]);

        return array_map(static function (WP_Post $page) use ($rate, $currency): array {
            $priceUsd = (float) get_post_meta($page->ID, 'price', true);

            return [
                'title' => $page->post_title,
                'link' => get_permalink($page),
                'priceUsd' => $priceUsd,
                'converted' => ['currency' => $currency, 'amount' => round($priceUsd * $rate, 2)],
            ];
        }, $pages);
    }

    public function permission(WP_REST_Request $request): bool
    {
        return true;
    }
}
