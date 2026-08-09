<?php

declare(strict_types=1);

use Dompdf\Dompdf;
use Loopress\Api\Attribute\Permission;

// Dynamic path segment: [order_id] in the folder name captures anything in
// that position and hands it to $request->get_param('order_id'), the same
// way a query param would. There's no catch-all, every segment is explicit
// and named, see api/orders/[order_id]/items/[item_id].php for more than
// one dynamic segment in the same route.
//
// Actually renders a PDF with dompdf/dompdf (installed via Composer, same
// pairing as prices-in-currency.php's Guzzle example), not JSON describing
// one. WordPress core always wp_json_encode()s whatever a route callback
// returns, there's no clean way around that for binary output within the
// normal WP_REST_Response flow, so this bypasses it on purpose: send the
// real headers, echo the raw PDF bytes, exit before WP's own dispatch gets
// a chance to serialize a return value. Any file-download REST endpoint in
// the wild does the same thing, it isn't specific to Loopress.
//
// Reuses the `price` page meta already seeded for prices-in-currency.php's
// ACF demo, an "order" here is just a page with a price, no separate orders
// table to fake.
#[Permission(public: true)]
final class InvoicePdf_OrderId
{
    public function get(WP_REST_Request $request): void
    {
        $orderId = (int) $request->get_param('order_id');
        $order = get_post($orderId);

        if ($order === null || $order->post_type !== 'page') {
            wp_die(esc_html("No order found for id {$orderId}"), '', ['response' => 404]);
        }

        $total = (float) get_post_meta($orderId, 'price', true);

        $dompdf = new Dompdf();
        $dompdf->loadHtml($this->invoiceHtml($order, $total));
        $dompdf->setPaper('A4');
        $dompdf->render();

        header('Content-Type: application/pdf');
        header("Content-Disposition: inline; filename=\"invoice-{$orderId}.pdf\"");
        header('Cache-Control: private, max-age=60');
        echo $dompdf->output(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- raw PDF binary, not HTML
        exit;
    }

    private function invoiceHtml(WP_Post $order, float $total): string
    {
        $title = esc_html($order->post_title);
        $formattedTotal = esc_html(number_format($total, 2));

        return <<<HTML
            <html>
                <body style="font-family: sans-serif;">
                    <h1>Invoice</h1>
                    <p><strong>Order:</strong> {$title}</p>
                    <p><strong>Total:</strong> \${$formattedTotal}</p>
                </body>
            </html>
            HTML;
    }
}
