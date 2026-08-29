<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\Entities\ClientEntityInterface;
use League\OAuth2\Server\Repositories\ClientRepositoryInterface;

// There's no admin screen for this demo, register() is meant to be called once (a snippet, a
// WP-CLI eval, ...) - none is wired up here, this file only demonstrates the plumbing a real
// site pushes through `lps api push`. See the cookbook recipe's "Registering a client".
final class OauthClients implements ClientRepositoryInterface
{
    public static function register(string $clientId, string $name, array $redirectUris, ?string $secret = null): void
    {
        $clients = get_option('oauth_clients', []);
        $clients[$clientId] = [
            'name'          => $name,
            'redirect_uris' => $redirectUris,
            'secret_hash'   => $secret !== null ? password_hash($secret, PASSWORD_DEFAULT) : null,
        ];
        update_option('oauth_clients', $clients, false);
    }

    public function getClientEntity($clientIdentifier): ?ClientEntityInterface
    {
        $client = get_option('oauth_clients', [])[$clientIdentifier] ?? null;

        return $client === null
            ? null
            : new OauthClientEntity($clientIdentifier, $client['name'], $client['redirect_uris'], $client['secret_hash'] !== null);
    }

    public function validateClient($clientIdentifier, $clientSecret, $grantType): bool
    {
        $client = get_option('oauth_clients', [])[$clientIdentifier] ?? null;
        if ($client === null) {
            return false;
        }

        if ($client['secret_hash'] === null) {
            return true;
        }

        return is_string($clientSecret) && password_verify($clientSecret, $client['secret_hash']);
    }
}
