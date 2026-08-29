<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

// Access tokens are self-signed JWTs, auth codes and refresh tokens are encrypted payloads, so
// nothing here stores a token's contents, only whether an identifier has since been revoked.
// One shared transient-backed ledger answers that for all three, see OauthAccessTokens,
// OauthAuthCodes, and OauthRefreshTokens.
final class OauthRevocationLedger
{
    public static function revoke(string $key, int $ttlSeconds): void
    {
        set_transient('oauth_revoked_' . $key, 1, $ttlSeconds);
    }

    public static function isRevoked(string $key): bool
    {
        return get_transient('oauth_revoked_' . $key) !== false;
    }
}
