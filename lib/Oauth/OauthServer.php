<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\AuthorizationServer;
use League\OAuth2\Server\Grant\AuthCodeGrant;
use League\OAuth2\Server\Grant\RefreshTokenGrant;

// One factory builds the configured AuthorizationServer, shared by api/oauth/authorize.php and
// api/oauth/token.php so the grant configuration (Authorization Code + PKCE, refresh) lives in
// exactly one place. See the OAuth2 PKCE cookbook recipe for the full walkthrough.
final class OauthServer
{
    public static function build(): AuthorizationServer
    {
        $server = new AuthorizationServer(
            new OauthClients(),
            new OauthAccessTokens(),
            new OauthScopes(),
            OauthKeys::privateKey(),
            OauthKeys::encryptionKey()
        );

        $authCodeGrant = new AuthCodeGrant(new OauthAuthCodes(), new OauthRefreshTokens(), new \DateInterval('PT10M'));
        $authCodeGrant->setRefreshTokenTTL(new \DateInterval('P1M'));
        $server->enableGrantType($authCodeGrant, new \DateInterval('PT1H'));

        $refreshGrant = new RefreshTokenGrant(new OauthRefreshTokens());
        $refreshGrant->setRefreshTokenTTL(new \DateInterval('P1M'));
        $server->enableGrantType($refreshGrant, new \DateInterval('PT1H'));

        return $server;
    }
}
