<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use Defuse\Crypto\Key;
use League\OAuth2\Server\CryptKey;

// RSA keypair signs access tokens as JWTs, a symmetric key encrypts auth codes and refresh
// tokens. Both generated once and stored in wp_options, see api/oauth/*.php and OauthServer.php.
// league/oauth2-server wants keys as files on disk, not strings, hence the throwaway temp file.
final class OauthKeys
{
    public static function privateKey(): CryptKey
    {
        return self::cryptKeyFromPem(self::keyPair()['private']);
    }

    public static function publicKey(): CryptKey
    {
        return self::cryptKeyFromPem(self::keyPair()['public']);
    }

    public static function encryptionKey(): string
    {
        $stored = get_option('oauth_encryption_key');
        if (is_string($stored) && $stored !== '') {
            return $stored;
        }

        $key = Key::createNewRandomKey()->saveToAsciiSafeString();
        update_option('oauth_encryption_key', $key, false);

        return $key;
    }

    private static function keyPair(): array
    {
        $stored = get_option('oauth_keypair');
        if (is_array($stored) && isset($stored['private'], $stored['public'])) {
            return $stored;
        }

        $resource = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($resource, $private);

        $pair = ['private' => $private, 'public' => openssl_pkey_get_details($resource)['key']];
        update_option('oauth_keypair', $pair, false);

        return $pair;
    }

    private static function cryptKeyFromPem(string $pem): CryptKey
    {
        $path = tempnam(sys_get_temp_dir(), 'oauth');
        file_put_contents($path, $pem);
        chmod($path, 0600);
        register_shutdown_function(static fn () => @unlink($path));

        return new CryptKey($path, null, false);
    }
}
