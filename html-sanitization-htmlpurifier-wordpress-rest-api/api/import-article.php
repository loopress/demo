<?php

declare(strict_types=1);

// Cleans HTML pushed in by an external system with HTML Purifier (ezyang/htmlpurifier,
// installed via Composer) before storing it as a draft post. HTML Purifier predates PHP
// namespaces: its classes live in the global namespace, so no `use` statement is needed.
// Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/content-and-data/html-sanitization-htmlpurifier-wordpress-rest-api/.
class ImportArticle
{
    public function post(WP_REST_Request $request): array|WP_Error
    {
        $title = sanitize_text_field((string) $request->get_param('title'));
        $html  = (string) $request->get_param('content');

        if ($title === '' || $html === '') {
            return new WP_Error('missing_fields', 'title and content are required.', ['status' => 400]);
        }

        $config = HTMLPurifier_Config::createDefault();
        $config->set('HTML.Allowed', 'p,a[href],strong,em,ul,ol,li,h2,h3,blockquote');
        $config->set('AutoFormat.RemoveEmpty', true);

        $clean = (new HTMLPurifier($config))->purify($html);

        $postId = wp_insert_post([
            'post_type'    => 'post',
            'post_status'  => 'draft',
            'post_title'   => $title,
            'post_content' => $clean,
        ]);

        return ['id' => $postId];
    }

    public function permission(WP_REST_Request $request): bool
    {
        return hash_equals((string) get_option('import_api_secret'), (string) $request->get_header('x-import-secret'));
    }
}
