<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Loopress\Api\Attribute\Permission;

// Returns one post, draft or not, to whoever holds a valid token for that exact post.
#[Permission(public: true)]
class Preview
{
    public function get(WP_REST_Request $request): array|WP_Error
    {
        $secret = defined('PREVIEW_JWT_SECRET') ? (string) PREVIEW_JWT_SECRET : (string) get_option('preview_jwt_secret');

        if (strlen($secret) < 32) {
            return new WP_Error('no_secret', 'Preview is not configured.', ['status' => 500]);
        }

        $postId = (int) $request->get_param('post_id');

        try {
            $claims = JWT::decode((string) $request->get_param('token'), new Key($secret, 'HS256'));
        } catch (Throwable) {
            return new WP_Error('invalid_token', 'Invalid or expired preview token.', ['status' => 401]);
        }

        // The token must be for this purpose and for this very post.
        if (($claims->aud ?? null) !== 'draft-preview' || (int) ($claims->sub ?? 0) !== $postId) {
            return new WP_Error('invalid_token', 'Invalid or expired preview token.', ['status' => 401]);
        }

        $post = get_post($postId);

        if ($post === null) {
            return new WP_Error('not_found', 'No post with that id.', ['status' => 404]);
        }

        return [
            'id'      => $post->ID,
            'status'  => $post->post_status,
            'title'   => get_the_title($post),
            'content' => apply_filters('the_content', $post->post_content),
        ];
    }
}
