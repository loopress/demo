<?php

declare(strict_types=1);

use Loopress\Api\Attribute\Permission;

// #[Permission] gives per-verb granularity a single file-level permission()
// can't: get() is a public health check (no auth needed to know the
// endpoint is alive), post() is the real webhook receiver, gated by a
// signed request rather than a fixed capability. callback: 'verifySignature'
// points at a local method on this same class, for a check reused across
// several files instead, see the shared, static version in
// api/orders/[order_id]/items/[item_id].php (lib/ApiKeyGuard.php).
final class Webhook
{
    #[Permission(public: true)]
    public function get(): array
    {
        return ['status' => 'ok'];
    }

    #[Permission(callback: 'verifySignature')]
    public function post(WP_REST_Request $request): array
    {
        // TODO: hand off to whatever this webhook is actually for.
        return ['received' => true];
    }

    public function verifySignature(WP_REST_Request $request): bool
    {
        $signature = (string) $request->get_header('x-webhook-signature');
        $expected = hash_hmac('sha256', (string) $request->get_body(), (string) get_option('demo_webhook_secret'));

        return hash_equals($expected, $signature);
    }
}
