<?php

declare(strict_types=1);

use Firebase\JWT\JWT;

// Issues a signed, 15 minute token for one post. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/auth-and-security/headless-draft-preview-php-jwt-wordpress-rest-api/.
class PreviewLink
{
    public function post(WP_REST_Request $request): array|WP_Error
    {
        $postId = (int) $request->get_param('post_id');

        if (get_post($postId) === null) {
            return new WP_Error('not_found', 'No post with that id.', ['status' => 404]);
        }

        // The key is a constant in wp-config.php, or the preview_jwt_secret option. php-jwt 7
        // refuses an HMAC key shorter than 32 bytes.
        $secret = defined('PREVIEW_JWT_SECRET') ? (string) PREVIEW_JWT_SECRET : (string) get_option('preview_jwt_secret');

        if (strlen($secret) < 32) {
            return new WP_Error('no_secret', 'Set PREVIEW_JWT_SECRET or the preview_jwt_secret option (32 characters or more).', ['status' => 500]);
        }

        $token = JWT::encode([
            'sub' => $postId,
            'aud' => 'draft-preview',
            'exp' => time() + 15 * MINUTE_IN_SECONDS,
        ], $secret, 'HS256');

        return [
            'token'      => $token,
            'expires_in' => 15 * MINUTE_IN_SECONDS,
        ];
    }

    public function permission(WP_REST_Request $request): bool
    {
        return current_user_can('edit_post', (int) $request->get_param('post_id'));
    }
}
