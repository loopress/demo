<?php

declare(strict_types=1);

use League\HTMLToMarkdown\HtmlConverter;
use Loopress\Api\Attribute\Permission;

// Serves one published post as Markdown for LLM crawlers and agents. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/content-and-data/markdown-export-for-llms-html-to-markdown-wordpress-rest-api/.
#[Permission(public: true)]
class PostMarkdown
{
    public function get(WP_REST_Request $request): void
    {
        $post = get_post((int) $request->get_param('post_id'));

        if ($post === null || $post->post_status !== 'publish' || post_password_required($post)) {
            status_header(404);
            header('Content-Type: application/json; charset=utf-8');
            echo wp_json_encode(['code' => 'not_found', 'message' => 'No published post with that id.']);
            exit;
        }

        $html = apply_filters('the_content', $post->post_content);

        $converter = new HtmlConverter([
            'strip_tags'   => true,
            'header_style' => 'atx',
        ]);

        // Raw Markdown, not JSON: set the header, send the body, stop.
        header('Content-Type: text/markdown; charset=utf-8');
        echo '# ' . get_the_title($post) . "\n\n" . $converter->convert($html) . "\n";
        exit;
    }
}
