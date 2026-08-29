<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\Entities\AuthCodeEntityInterface;
use League\OAuth2\Server\Repositories\AuthCodeRepositoryInterface;

final class OauthAuthCodes implements AuthCodeRepositoryInterface
{
    public function getNewAuthCode(): AuthCodeEntityInterface
    {
        return new OauthAuthCodeEntity();
    }

    public function persistNewAuthCode(AuthCodeEntityInterface $authCodeEntity): void
    {
        // Nothing to store yet, the code is only marked used once it's redeemed, below.
    }

    public function revokeAuthCode($codeId): void
    {
        OauthRevocationLedger::revoke($codeId, 10 * MINUTE_IN_SECONDS);
    }

    public function isAuthCodeRevoked($codeId): bool
    {
        return OauthRevocationLedger::isRevoked($codeId);
    }
}
