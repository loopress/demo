<?php

declare(strict_types=1);

// Simplest possible route: one file, one class, one public verb method.
// Deployed with `lps api push`, exposed at loopress-api/v1/hello.
// Default permission (manage_options + Application Password) applies since
// this file declares no permission() override.
final class Hello
{
    public function get(WP_REST_Request $request): array
    {
        return ['hello' => 'world'];
    }
}
