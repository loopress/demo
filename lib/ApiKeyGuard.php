<?php

declare(strict_types=1);

namespace LoopressLib;

use WP_REST_Request;

// Lives in lib/, not api/: a permission check reused across several route
// files, never a route on its own, lib/ is never scanned for routing.
// Autoloaded under the LoopressLib\ namespace (wired automatically into the
// site's composer.json by Loopress Full), so any api/ file can
// `use LoopressLib\ApiKeyGuard;` directly, no manual require.
final class ApiKeyGuard
{
    public static function check(WP_REST_Request $request): bool
    {
        return hash_equals((string) get_option('demo_api_key'), (string) $request->get_param('api_key'));
    }
}
