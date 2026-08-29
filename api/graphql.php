<?php

declare(strict_types=1);

use GraphQL\GraphQL;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\Type\Schema;

// Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/search-and-data-services/graphql-wordpress-rest-api-route/
// line for line: `product` / `_price` is WooCommerce's real post type and price meta key, not a
// stand-in like prices-in-currency.php's page + ACF field, so this route only resolves real data
// on a site that has WooCommerce active. This demo doesn't install WooCommerce, so on the CI
// instance the query still executes and returns well-formed JSON, just with `product: null`, same
// "empty but correct" pattern as prices-in-currency.php and orders-export.php.
//
// Named GraphqlRoute, not Graphql: the class name is free (the filename alone decides the route,
// see /api/routes/), and `Graphql` collides case-insensitively with the `GraphQL` class imported
// above from webonyx/graphql-php, PHP class names are case-insensitive, `use GraphQL\GraphQL;`
// plus `class Graphql` in the same (global) namespace is a fatal "Cannot redeclare class".
final class GraphqlRoute
{
    public function post(WP_REST_Request $request): array
    {
        $productType = new ObjectType([
            'name'   => 'Product',
            'fields' => [
                'id'    => Type::nonNull(Type::id()),
                'title' => Type::string(),
                'price' => Type::float(),
            ],
        ]);

        $queryType = new ObjectType([
            'name'   => 'Query',
            'fields' => [
                'product' => [
                    'type'    => $productType,
                    'args'    => ['id' => Type::nonNull(Type::id())],
                    'resolve' => static function ($root, array $args): ?array {
                        $post = get_post((int) $args['id']);
                        if ($post === null || $post->post_type !== 'product') {
                            return null;
                        }

                        return [
                            'id'    => (string) $post->ID,
                            'title' => $post->post_title,
                            'price' => (float) get_post_meta($post->ID, '_price', true),
                        ];
                    },
                ],
            ],
        ]);

        $schema = new Schema(['query' => $queryType]);
        $body   = $request->get_json_params() ?? [];

        $result = GraphQL::executeQuery(
            $schema,
            (string) ($body['query'] ?? ''),
            null,
            null,
            $body['variables'] ?? null
        );

        return $result->toArray();
    }

    public function permission(): bool
    {
        return true;
    }
}
