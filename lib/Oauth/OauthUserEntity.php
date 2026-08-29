<?php

declare(strict_types=1);

namespace LoopressLib\Oauth;

use League\OAuth2\Server\Entities\Traits\EntityTrait;
use League\OAuth2\Server\Entities\UserEntityInterface;

final class OauthUserEntity implements UserEntityInterface
{
    use EntityTrait;

    public function __construct(\WP_User $user)
    {
        $this->identifier = (string) $user->ID;
    }
}
