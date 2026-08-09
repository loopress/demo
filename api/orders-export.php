<?php

declare(strict_types=1);

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// Turns WP_Query-shaped data into a downloadable .xlsx with phpoffice/phpspreadsheet (installed
// via Composer, same pairing as prices-in-currency.php's Guzzle example). Reuses the same
// `price` page meta as prices-in-currency.php and invoice-pdf/[order_id].php instead of pulling
// in WooCommerce for one demo route, an "order" here is a page with a price, no separate orders
// table to fake. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/spreadsheet-export-phpspreadsheet-wordpress-rest-api/,
// which exports real WooCommerce orders through wc_get_orders() (HPOS-safe) rather than
// get_posts(), the real thing this route stands in for.
//
// No page in this demo actually sets a price (see prices-in-currency.php), so the exported file
// is a well-formed but empty spreadsheet beyond its header row, same caveat as that route.
final class OrdersExport
{
    public function get(): WP_REST_Response
    {
        $pages = get_posts([
            'post_type' => 'page',
            'meta_key' => 'price',
            'numberposts' => -1,
        ]);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Orders');
        $sheet->fromArray(['Page ID', 'Title', 'Price (USD)'], null, 'A1');

        $row = 2;
        foreach ($pages as $page) {
            $sheet->fromArray([
                $page->ID,
                $page->post_title,
                (float) get_post_meta($page->ID, 'price', true),
            ], null, "A{$row}");
            $row++;
        }

        $stream = fopen('php://temp', 'r+');
        (new Xlsx($spreadsheet))->save($stream);
        rewind($stream);
        $bytes = stream_get_contents($stream);
        fclose($stream);

        $response = new WP_REST_Response([
            'filename' => 'orders-' . gmdate('Y-m-d') . '.xlsx',
            'content' => base64_encode($bytes),
        ]);
        $response->header('Cache-Control', 'private, max-age=0, no-store');

        return $response;
    }

    public function permission(WP_REST_Request $request): bool
    {
        return current_user_can('manage_options');
    }
}
