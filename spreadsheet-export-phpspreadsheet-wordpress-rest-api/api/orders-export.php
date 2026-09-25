<?php

declare(strict_types=1);

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// Turns completed WooCommerce orders into a downloadable .xlsx with phpoffice/phpspreadsheet
// (installed via Composer, same as WooCommerce itself: wpackagist-plugin/woocommerce in
// this project's composer.json). wc_get_orders() is HPOS-safe, unlike querying the legacy
// shop_order post type directly. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/spreadsheet-export-phpspreadsheet-wordpress-rest-api/.
//
// A void return and an explicit exit bypass WordPress's JSON serialization on purpose: real
// headers, raw .xlsx bytes streamed straight to the response body.
class OrdersExport
{
    public function get(): void
    {
        $orders = wc_get_orders([
            'status' => 'completed',
            'limit'  => -1,
        ]);

        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Orders');
        $sheet->fromArray(['Order ID', 'Date', 'Total', 'Customer email'], null, 'A1');

        $row = 2;
        foreach ($orders as $order) {
            $sheet->fromArray([
                $order->get_id(),
                $order->get_date_created()?->format('Y-m-d'),
                (float) $order->get_total(),
                $order->get_billing_email(),
            ], null, "A{$row}");
            $row++;
        }

        $filename = 'orders-' . gmdate('Y-m-d') . '.xlsx';

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: private, max-age=0, no-store');

        (new Xlsx($spreadsheet))->save('php://output');
        exit;
    }

    // Unfiltered order and customer data: stays on the closed default, stated explicitly.
    public function permission(WP_REST_Request $request): bool
    {
        return current_user_can('manage_options');
    }
}
