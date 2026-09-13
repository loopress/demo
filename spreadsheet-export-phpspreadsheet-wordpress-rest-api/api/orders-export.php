<?php

declare(strict_types=1);

use Loopress\Api\Attribute\Permission;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// Turns real WooCommerce orders into a downloadable .xlsx with phpoffice/phpspreadsheet
// (installed via Composer, same as WooCommerce itself: wpackagist-plugin/woocommerce in
// this project's composer.json, composer.json isn't just for PHP libraries). wc_get_orders()
// is HPOS-safe (works whether High-Performance Order Storage is on or not), unlike querying
// the legacy shop_order post type directly. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/spreadsheet-export-phpspreadsheet-wordpress-rest-api/.
//
// Raw binary output instead of the base64-in-JSON envelope the cookbook recipe uses, same
// bypass as post-pdf/[post_id].php: WordPress always wp_json_encode()s a normal route
// return value, so there's no way to hand back real .xlsx bytes through that path. Send the
// real headers, write the file straight to the output stream, exit before WP's own dispatch
// gets a chance to serialize anything.
//
// No order exists in a fresh WooCommerce install, so the exported file is a well-formed but
// empty spreadsheet beyond its header row.
#[Permission(public: true)]
final class OrdersExport
{
    public function get(): void
    {
        $orders = wc_get_orders(['limit' => -1]);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Orders');
        $sheet->fromArray(['Order ID', 'Status', 'Total', 'Date'], null, 'A1');

        $row = 2;
        foreach ($orders as $order) {
            $sheet->fromArray([
                $order->get_id(),
                $order->get_status(),
                (float) $order->get_total(),
                $order->get_date_created()?->format('Y-m-d') ?? '',
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
