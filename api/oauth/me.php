<?php

declare(strict_types=1);

use League\OAuth2\Server\Exception\OAuthServerException;
use League\OAuth2\Server\ResourceServer;
use LoopressLib\Oauth\OauthAccessTokens;
use LoopressLib\Oauth\OauthKeys;
use LoopressLib\Oauth\OauthPsr7;

// Gated by the bearer access token itself, validated through league/oauth2-server's
// ResourceServer, which annotates the PSR-7 request with the token's subject on success. No
// claims-extraction machinery needed, the token's subject is a WordPress user ID.
class OauthMe
{
    public function get(): array|WP_Error
    {
        $resourceServer = new ResourceServer(new OauthAccessTokens(), OauthKeys::publicKey());

        try {
            $request = $resourceServer->validateAuthenticatedRequest(OauthPsr7::request());
        } catch (OAuthServerException $exception) {
            return new WP_Error('invalid_token', $exception->getMessage(), ['status' => $exception->getHttpStatusCode()]);
        }

        $user = get_user_by('id', (int) $request->getAttribute('oauth_user_id'));
        if (!$user instanceof WP_User) {
            return new WP_Error('invalid_token', 'Unknown user.', ['status' => 401]);
        }

        return [
            'id'    => $user->ID,
            'name'  => $user->display_name,
            'email' => $user->user_email,
        ];
    }

    public function permission(): bool
    {
        return true;
    }
}
