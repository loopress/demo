<?php

declare(strict_types=1);

// Deliberately invalid filename: uppercase letters aren't allowed (every
// path segment must be lowercase kebab-case, or a bracketed dynamic segment
// like [order_id]). `lps api push` rejects this client-side, before any
// network call, this file exists to demonstrate that failure, it's never
// meant to actually deploy.
final class WITH_MAJ_ENDPOINT
{
    public function get(WP_REST_Request $request): array
    {
        return ['WITH_MAJ' => 'ENDPOINT'];
    }

    public function permission(WP_REST_Request $request): bool
    {
        return true;
    }
}
