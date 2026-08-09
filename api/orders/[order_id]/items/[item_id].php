<?php

declare(strict_types=1);

use Loopress\Api\Attribute\Permission;
use LoopressLib\ApiKeyGuard;

// Two dynamic segments at different depths, order_id and item_id, both
// available through $request->get_param(). Each segment is PascalCased and
// joined with '_', brackets stripped: Orders_OrderId_Items_ItemId. The '_'
// keeps the segment boundary intact, plain concatenation could otherwise
// collide with a same-looking class name from a differently nested route.
//
// #[Permission] here points at a *shared* static method in lib/ instead of
// a local one (compare api/webhook.php's local callback: the same
// mechanism, just a class-string target), the way to reuse one check across
// several route files without copying it into each.
#[Permission(callback: [ApiKeyGuard::class, 'check'])]
final class Orders_OrderId_Items_ItemId
{
    public function get(WP_REST_Request $request): array
    {
        return [
            'order_id' => $request->get_param('order_id'),
            'item_id' => $request->get_param('item_id'),
        ];
    }
}
