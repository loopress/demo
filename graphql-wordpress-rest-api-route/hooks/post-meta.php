<?php

declare(strict_types=1);

use Loopress\Hooks\Attribute\Action;

// ACF's own "Show in REST API" field setting doesn't register `reading_time`/`summary`
// as core REST-writable postmeta on every ACF version, a `meta` (or `acf`) key in a
// wp/v2/posts POST body silently no-ops without it. register_post_meta() is what WP's
// REST controller actually checks before accepting a meta key, and it's the same postmeta
// key ACF's own get_field() reads, so both stay in sync without ACF needing to know this
// registration exists. Real need beyond this recipe's own seed data: any headless client
// writing these fields over the core REST API, not just GraphQL reading them, needs this
// same registration.
class PostMeta
{
    #[Action('init')]
    public function register(): void
    {
        register_post_meta('post', 'reading_time', [
            'single' => true,
            'type' => 'number',
            'show_in_rest' => true,
        ]);

        register_post_meta('post', 'summary', [
            'single' => true,
            'type' => 'string',
            'show_in_rest' => true,
        ]);
    }
}
