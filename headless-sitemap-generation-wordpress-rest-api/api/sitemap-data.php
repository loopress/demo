<?php

declare(strict_types=1);

use Icamys\SitemapGenerator\Config;
use Icamys\SitemapGenerator\SitemapGenerator;

// Builds the sitemap for a headless front end's own domain, from the posts and pages WordPress
// holds, with icamys/php-sitemap-generator (installed via Composer). Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/content-and-data/headless-sitemap-generation-wordpress-rest-api/.
// Set two options first: `headless_frontend_url` (e.g. https://www.example.com, no trailing slash)
// and `sitemap_build_secret`, the value the front end's build sends in `x-build-secret`.
class SitemapData
{
    // The protocol caps one sitemap file at 50,000 URLs: stay under it so one file is enough.
    private const MAX_URLS = 50000;

    public function get(WP_REST_Request $request): array|WP_Error
    {
        $baseUrl = rtrim((string) get_option('headless_frontend_url'), '/');
        if (wp_http_validate_url($baseUrl) === false) {
            return new WP_Error('no_frontend_url', 'Set the headless_frontend_url option first.', ['status' => 500]);
        }

        // The library only writes to disk: give it a directory of its own, removed afterwards.
        $dir = trailingslashit(sys_get_temp_dir()) . 'sitemap-' . wp_generate_uuid4();
        mkdir($dir, 0700);

        try {
            $config = new Config();
            $config->setBaseURL($baseUrl);
            $config->setSaveDirectory($dir);

            $generator = new SitemapGenerator($config);
            $generator->setSitemapFilename('headless-sitemap.xml');

            $ids = get_posts([
                'post_type'              => ['post', 'page'],
                'post_status'            => 'publish',
                'posts_per_page'         => self::MAX_URLS,
                'fields'                 => 'ids',
                'orderby'                => 'modified',
                'no_found_rows'          => true,
                'update_post_term_cache' => false,
                'update_post_meta_cache' => false,
            ]);

            foreach ($ids as $id) {
                // The path only: the front end serves the same permalinks on its own domain.
                $path     = wp_make_link_relative(get_permalink($id));
                $modified = new DateTime((string) get_post_modified_time('c', true, $id));
                $generator->addURL($path, $modified, 'weekly', get_post_type($id) === 'page' ? 0.9 : 0.8);
            }

            $generator->flush();
            $generator->finalize();

            return ['xml' => (string) file_get_contents($dir . '/headless-sitemap.xml'), 'urls' => count($ids)];
        } finally {
            array_map('unlink', glob($dir . '/*') ?: []);
            rmdir($dir);
        }
    }

    public function permission(WP_REST_Request $request): bool
    {
        $secret = (string) get_option('sitemap_build_secret');

        // An unset option would otherwise match a missing header: hash_equals('', '') is true.
        return $secret !== '' && hash_equals($secret, (string) $request->get_header('x-build-secret'));
    }
}
