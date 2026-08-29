<?php

declare(strict_types=1);

use Loopress\Api\Attribute\Permission;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class OrdersExport
{
    #[Permission(public: true)]
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
                $order->get_total(),
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
}
