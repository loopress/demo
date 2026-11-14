<?php
/**
 * Test-only must-use plugin: a fake Algolia for the instant-search-algolia recipe spec.
 *
 * Copy it to wp-content/mu-plugins/. It does not touch the recipe's hook. It swaps the
 * HTTP transport of algolia/algoliasearch-client-php (Algolia::setHttpClient, the client's
 * documented extension point) for one that never leaves the site: the request the client
 * built (method, URL, headers, JSON body) is recorded, and a canned success answers it.
 * Credentials come from the two options the recipe reads, filled with dummy values.
 *
 * GET    /wp-json/fake-algolia/v1/requests  the recorded requests (administrators)
 * DELETE /wp-json/fake-algolia/v1/requests  forget them
 */

use Algolia\AlgoliaSearch\Algolia;
use Algolia\AlgoliaSearch\Http\HttpClientInterface;
use Algolia\AlgoliaSearch\Http\Psr7\Response;

const FAKE_ALGOLIA_OPTION = 'fake_algolia_requests';

add_filter('pre_option_algolia_app_id', static fn () => 'FAKEAPPID');
add_filter('pre_option_algolia_write_key', static fn () => 'fake-write-key');

$install = static function (): void {
    if (!interface_exists(HttpClientInterface::class)) {
        return;
    }

    Algolia::setHttpClient(new class implements HttpClientInterface {
        public function sendRequest($request, $timeout, $connectTimeout)
        {
            $log = get_option(FAKE_ALGOLIA_OPTION, []);
            $log[] = [
                'method' => $request->getMethod(),
                'host' => $request->getUri()->getHost(),
                'path' => $request->getUri()->getPath(),
                'apiKey' => $request->getHeaderLine('x-algolia-api-key'),
                'appId' => $request->getHeaderLine('x-algolia-application-id'),
                'body' => json_decode((string) $request->getBody(), true),
            ];
            update_option(FAKE_ALGOLIA_OPTION, $log, false);

            return new Response(200, ['Content-Type' => 'application/json'], '{"taskID":1,"objectID":"fake","updatedAt":"2026-01-01T00:00:00Z"}');
        }
    });
};

add_action('woocommerce_new_product', $install, 1);
add_action('woocommerce_update_product', $install, 1);

add_action('rest_api_init', static function (): void {
    register_rest_route('fake-algolia/v1', '/requests', [
        [
            'methods' => 'GET',
            'permission_callback' => static fn () => current_user_can('manage_options'),
            'callback' => static fn () => get_option(FAKE_ALGOLIA_OPTION, []),
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => static fn () => current_user_can('manage_options'),
            'callback' => static function () {
                delete_option(FAKE_ALGOLIA_OPTION);

                return [];
            },
        ],
    ]);
});
