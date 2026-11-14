<?php

declare(strict_types=1);

use GraphQL\GraphQL;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\Type\Schema;
use GraphQL\Validator\DocumentValidator;
use GraphQL\Validator\Rules\QueryComplexity;
use GraphQL\Validator\Rules\QueryDepth;

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
                        // The route is public: only expose what the caller may read on the
                        // site (published posts, plus drafts and private posts for users who can
                        // edit them), and never a password-protected post's fields.
                        if (
                            $post === null
                            || $post->post_type !== 'post'
                            || ($post->post_status !== 'publish' && !current_user_can('read_post', $post->ID))
                            || post_password_required($post)
                        ) {
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

        // Limits for a public endpoint: reject deeply nested or expensive queries before they run.
        // GraphiQL's own introspection query is 13 levels deep, so the depth cap stays above it.
        DocumentValidator::addRule(new QueryDepth(15));
        DocumentValidator::addRule(new QueryComplexity(100));

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
