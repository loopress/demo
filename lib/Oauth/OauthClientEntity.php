<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\Entities\ClientEntityInterface;
use League\OAuth2\Server\Entities\Traits\ClientTrait;
use League\OAuth2\Server\Entities\Traits\EntityTrait;

// A client is a registered app: its ID, allowed redirect URIs, and an optional secret.
// One class per file here, not grouped by concern like lib/ApiKeyGuard.php's comment implies is
// optional: lib/ is autoloaded through plain Composer PSR-4 (LoopressLib\ => lib/), which only
// resolves a class whose name matches its file's name, see OauthClients.php next to this one.
final class OauthClientEntity implements ClientEntityInterface
{
    use ClientTrait;
    use EntityTrait;

    public function __construct(string $identifier, string $name, array $redirectUris, bool $isConfidential)
    {
        $this->identifier = $identifier;
        $this->name = $name;
        $this->redirectUri = $redirectUris;
        $this->isConfidential = $isConfidential;
    }
}
