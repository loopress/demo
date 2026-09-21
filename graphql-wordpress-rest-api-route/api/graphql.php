<?php

declare(strict_types=1);

use GraphQL\GraphQL;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\Type\Schema;

// Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/search-and-data-services/graphql-wordpress-rest-api-route/
// line for line, with one addition: `readingTime` and `summary` are read with `get_field()`
// instead of `get_post_meta()`, because both come from the field group this project's own
// `acf/` deploys via `lps acf push`, attached to WordPress's own `post` type, not a custom
// one, so this stays demonstrable without WooCommerce or any other plugin. The point is the
// composition: a schema defined and synced by Loopress (ACF), read by a custom API route
// also managed by Loopress (this file), in one request.
final class GraphqlRoute
{
    public function post(WP_REST_Request $request): array
    {
        $postType = new ObjectType([
            'name' => 'Post',
            'fields' => [
                'id' => Type::nonNull(Type::id()),
                'title' => Type::string(),
                'readingTime' => Type::float(),
                'summary' => Type::string(),
            ],
        ]);

        $queryType = new ObjectType([
            'name' => 'Query',
            'fields' => [
                'post' => [
                    'type' => $postType,
                    'args' => ['id' => Type::nonNull(Type::id())],
                    'resolve' => static function ($root, array $args): ?array {
                        $post = get_post((int) $args['id']);
                        if ($post === null || $post->post_type !== 'post') {
                            return null;
                        }

                        return [
                            'id' => (string) $post->ID,
                            'title' => $post->post_title,
                            'readingTime' => (float) get_field('reading_time', $post->ID),
                            'summary' => (string) get_field('summary', $post->ID),
                        ];
                    },
                ],
            ],
        ]);

        $schema = new Schema(['query' => $queryType]);
        $body = $request->get_json_params() ?? [];

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
