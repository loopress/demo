<?php

declare(strict_types=1);

use League\OAuth2\Server\Exception\OAuthServerException;
use LoopressLib\Oauth\OauthPsr7;
use LoopressLib\Oauth\OauthServer;
use LoopressLib\Oauth\OauthUserEntity;
use Nyholm\Psr7\Factory\Psr17Factory;

// The one route a browser navigates to directly rather than an app calling programmatically, so
// permission() redirects to the WordPress login screen instead of returning a bare false. A
// logged-in user is taken as having already approved the client, no consent screen, see the
// OAuth2 PKCE cookbook recipe this mirrors line for line.
class OauthAuthorize
{
    public function get(): void
    {
        $psr17 = new Psr17Factory();

        try {
            $authRequest = OauthServer::build()->validateAuthorizationRequest(OauthPsr7::request());
        } catch (OAuthServerException $exception) {
            OauthPsr7::emit($exception->generateHttpResponse($psr17->createResponse()));
            return;
        }

        $authRequest->setUser(new OauthUserEntity(wp_get_current_user()));
        $authRequest->setAuthorizationApproved(true);

        OauthPsr7::emit(OauthServer::build()->completeAuthorizationRequest($authRequest, $psr17->createResponse()));
    }

    public function permission(): bool
    {
        if (is_user_logged_in()) {
            return true;
        }

        wp_redirect(wp_login_url($_SERVER['REQUEST_URI'] ?? ''));
        exit;
    }
}
