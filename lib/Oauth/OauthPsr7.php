<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7Server\ServerRequestCreator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

// league/oauth2-server speaks PSR-7, WordPress hands api/oauth/*.php a WP_REST_Request.
// nyholm/psr7-server builds a PSR-7 request straight from the PHP superglobals WordPress leaves
// untouched underneath its own request object, emit() writes the response back with the same
// header()/raw-body pattern demoed by api/post-pdf/[post_id].php.
final class OauthPsr7
{
    public static function request(): ServerRequestInterface
    {
        $factory = new Psr17Factory();
        $creator = new ServerRequestCreator($factory, $factory, $factory, $factory);

        return $creator->fromGlobals();
    }

    public static function emit(ResponseInterface $response): never
    {
        http_response_code($response->getStatusCode());
        foreach ($response->getHeaders() as $name => $values) {
            header($name . ': ' . implode(', ', $values));
        }

        echo (string) $response->getBody();
        exit;
    }
}
