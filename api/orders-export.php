<?php

declare(strict_types=1);

use Loopress\Api\Attribute\Permission;
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
// Raw binary output instead of the base64-in-JSON envelope the cookbook recipe uses, same
// bypass as invoice-pdf/[order_id].php: WordPress always wp_json_encode()s a normal route
// return value, so there's no way to hand back real .xlsx bytes through that path. Send the
// real headers, write the file straight to the output stream, exit before WP's own dispatch
// gets a chance to serialize anything.
//
// No page in this demo actually sets a price (see prices-in-currency.php), so the exported file
// is a well-formed but empty spreadsheet beyond its header row, same caveat as that route.
#[Permission(public: true)]
final class OrdersExport
{
    public function get(): void
    {
        /** @var WP_Post[] $pages */
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

        $filename = 'orders-' . gmdate('Y-m-d') . '.xlsx';

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: private, max-age=0, no-store');

        // Writes straight to the response body, no intermediate php://temp buffer needed now
        // that the bytes don't have to be collected into a string for a base64/JSON envelope.
        (new Xlsx($spreadsheet))->save('php://output');
        exit;
    }
}
