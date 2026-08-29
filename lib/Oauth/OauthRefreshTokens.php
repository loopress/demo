<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\Entities\RefreshTokenEntityInterface;
use League\OAuth2\Server\Repositories\RefreshTokenRepositoryInterface;

final class OauthRefreshTokens implements RefreshTokenRepositoryInterface
{
    public function getNewRefreshToken(): ?RefreshTokenEntityInterface
    {
        return new OauthRefreshTokenEntity();
    }

    public function persistNewRefreshToken(RefreshTokenEntityInterface $refreshTokenEntity): void
    {
        // Same reasoning as the access token, the encrypted payload carries its own data.
    }

    public function revokeRefreshToken($tokenId): void
    {
        OauthRevocationLedger::revoke($tokenId, MONTH_IN_SECONDS);
    }

    public function isRefreshTokenRevoked($tokenId): bool
    {
        return OauthRevocationLedger::isRevoked($tokenId);
    }
}
