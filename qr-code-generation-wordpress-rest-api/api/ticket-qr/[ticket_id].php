<?php

declare(strict_types=1);

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\PngWriter;

// Renders a scannable QR code for one event ticket on request with endroid/qr-code,
// instead of storing a PNG per ticket sold. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/qr-code-generation-wordpress-rest-api/.
class TicketQr
{
    public function get(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $ticketId = (int) $request->get_param('ticket_id');
        $ticket   = get_post($ticketId);

        if ($ticket === null || $ticket->post_type !== 'ticket') {
            return new WP_Error('not_found', 'No ticket with that id.', ['status' => 404]);
        }

        $verifyUrl = add_query_arg('ticket', $ticketId, home_url('/verify-ticket/'));

        $builder = new Builder(
            writer: new PngWriter(),
            data: $verifyUrl,
            size: 300,
            margin: 10,
        );

        $result = $builder->build();

        $response = new WP_REST_Response([
            'data_uri' => 'data:image/png;base64,' . base64_encode($result->getString()),
        ]);
        $response->header('Cache-Control', 'private, max-age=3600');

        return $response;
    }

    // An entry credential: the ticket's own buyer or a site admin, nobody else.
    public function permission(WP_REST_Request $request): bool
    {
        if (current_user_can('manage_options')) {
            return true;
        }

        $ticketId = (int) $request->get_param('ticket_id');
        return is_user_logged_in()
            && (int) get_post_meta($ticketId, '_customer_id', true) === get_current_user_id();
    }
}
