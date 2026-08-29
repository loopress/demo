<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\Entities\AccessTokenEntityInterface;
use League\OAuth2\Server\Entities\ClientEntityInterface;
use League\OAuth2\Server\Repositories\AccessTokenRepositoryInterface;

final class OauthAccessTokens implements AccessTokenRepositoryInterface
{
    public function getNewToken(ClientEntityInterface $clientEntity, array $scopes, $userIdentifier = null): AccessTokenEntityInterface
    {
        $token = new OauthAccessTokenEntity();
        $token->setClient($clientEntity);
        $token->setUserIdentifier($userIdentifier);
        foreach ($scopes as $scope) {
            $token->addScope($scope);
        }

        return $token;
    }

    public function persistNewAccessToken(AccessTokenEntityInterface $accessTokenEntity): void
    {
        // The JWT is self-verifying, nothing to store until it's revoked.
    }

    public function revokeAccessToken($tokenId): void
    {
        OauthRevocationLedger::revoke($tokenId, HOUR_IN_SECONDS);
    }

    public function isAccessTokenRevoked($tokenId): bool
    {
        return OauthRevocationLedger::isRevoked($tokenId);
    }
}
