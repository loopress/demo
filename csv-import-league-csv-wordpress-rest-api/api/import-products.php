<?php

declare(strict_types=1);

use League\Csv\Reader;

// Imports a supplier CSV as draft catalog products. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/csv-import-league-csv-wordpress-rest-api/.
class ImportProducts
{
    private const MAX_ROWS = 1000;

    public function post(WP_REST_Request $request): array|WP_Error
    {
        $csv = (string) $request->get_param('csv');
        if ($csv === '') {
            return new WP_Error('missing_csv', 'No csv field in the request body.', ['status' => 400]);
        }

        try {
            $reader = Reader::fromString($csv);
            $reader->setHeaderOffset(0);
            $header = $reader->getHeader();
        } catch (Throwable) {
            return new WP_Error('invalid_csv', 'The csv could not be parsed.', ['status' => 400]);
        }

        if (array_diff(['sku', 'name', 'price'], $header) !== []) {
            return new WP_Error('invalid_header', 'The header row must contain sku, name and price.', ['status' => 400]);
        }

        // Refuse before creating anything: a file over the cap must not be half imported.
        if (count($reader) > self::MAX_ROWS) {
            return new WP_Error('too_many_rows', 'At most ' . self::MAX_ROWS . ' rows per import.', ['status' => 413]);
        }

        $created = [];
        $errors  = [];

        foreach ($reader->getRecords() as $offset => $record) {
            $sku   = trim((string) ($record['sku'] ?? ''));
            $name  = trim((string) ($record['name'] ?? ''));
            $price = trim((string) ($record['price'] ?? ''));

            if ($sku === '' || !is_numeric($price) || (float) $price < 0) {
                $errors[] = "row {$offset}: missing sku or invalid price";
                continue;
            }

            $existing = get_posts([
                'post_type'      => 'catalog-product',
                'post_status'    => 'any',
                'meta_key'       => '_sku',
                'meta_value'     => $sku,
                'fields'         => 'ids',
                'posts_per_page' => 1,
            ]);
            if ($existing !== []) {
                $errors[] = "row {$offset}: sku {$sku} already exists";
                continue;
            }

            $id = wp_insert_post([
                'post_type'   => 'catalog-product',
                'post_status' => 'draft',
                'post_title'  => $name !== '' ? $name : $sku,
                'meta_input'  => ['_sku' => $sku, '_price' => $price],
            ], true);

            if (is_wp_error($id)) {
                $errors[] = "row {$offset}: {$id->get_error_message()}";
                continue;
            }
            $created[] = $id;
        }

        return ['created' => $created, 'errors' => $errors];
    }

    public function permission(): bool
    {
        // Editors and above: bulk-creating drafts is an editorial action, not a site setting.
        return current_user_can('edit_others_posts');
    }
}
