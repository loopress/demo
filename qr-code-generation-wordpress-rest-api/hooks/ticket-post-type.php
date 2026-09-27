<?php

declare(strict_types=1);

use Loopress\Hooks\Attribute\Action;

// One `ticket` post per ticket sold, the buyer's user id in `_customer_id` postmeta.
// api/ticket-qr/[ticket_id].php only answers for posts of this type.
class TicketPostType
{
    #[Action('init')]
    public function register(): void
    {
        register_post_type('ticket', [
            'labels'       => [
                'name'          => 'Tickets',
                'singular_name' => 'Ticket',
                'add_new_item'  => 'Add Ticket',
                'search_items'  => 'Search Tickets',
            ],
            'public'       => false,
            'show_ui'      => true,
            'show_in_rest' => true,
            'menu_icon'    => 'dashicons-tickets-alt',
            'supports'     => ['title'],
        ]);
    }
}
