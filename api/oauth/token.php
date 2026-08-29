<?php

declare(strict_types=1);

use League\OAuth2\Server\Exception\OAuthServerException;
use LoopressLib\Oauth\OauthPsr7;
use LoopressLib\Oauth\OauthServer;
use Nyholm\Psr7\Factory\Psr17Factory;

// Public: the client authenticates itself inside the POST body (the PKCE verifier), not as a
// WordPress user, so permission() doesn't gate anything here, respondToAccessTokenRequest() does.
class OauthToken
{
    public function post(): void
    {
        $psr17 = new Psr17Factory();

        try {
            $response = OauthServer::build()->respondToAccessTokenRequest(OauthPsr7::request(), $psr17->createResponse());
        } catch (OAuthServerException $exception) {
            $response = $exception->generateHttpResponse($psr17->createResponse());
        }

        OauthPsr7::emit($response);
    }

    public function permission(): bool
    {
        return true;
    }
}
