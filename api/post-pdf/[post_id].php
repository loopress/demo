<?php

declare(strict_types=1);

use Dompdf\Dompdf;

// Dynamic path segment: [post_id] in the folder name captures anything in
// that position and hands it to $request->get_param('post_id'), the same
// way a query param would. There's no catch-all, every segment is explicit
// and named, see api/orders/[order_id]/items/[item_id].php for more than
// one dynamic segment in the same route.
//
// Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/post-to-pdf-dompdf-wordpress-rest-api/
// line for line: any published post, no separate content to seed for this one, "Hello world!"
// (post 1, WordPress's own default) renders through it as-is.
//
// Raw binary output instead of JSON, same bypass as invoice-pdf/[order_id].php used to be:
// WordPress always wp_json_encode()s a normal route return value, so there's no clean way to
// hand back real PDF bytes through that path. Send the real headers, echo the raw bytes, exit
// before WP's own dispatch gets a chance to serialize anything.
final class PostPdf_PostId
{
    public function get(WP_REST_Request $request): void
    {
        $postId = (int) $request->get_param('post_id');
        $post = get_post($postId);

        if ($post === null || $post->post_status !== 'publish') {
            wp_die(esc_html('No published post with that id.'), '', ['response' => 404]);
        }

        $dompdf = new Dompdf();
        $dompdf->loadHtml($this->postHtml($post));
        $dompdf->setPaper('A4');
        $dompdf->render();

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . sanitize_title($post->post_title) . '.pdf"');
        header('Cache-Control: public, max-age=3600');
        echo $dompdf->output();
        exit;
    }

    private function postHtml(WP_Post $post): string
    {
        $title = esc_html($post->post_title);

        // Already-safe rendered HTML from WordPress's own content pipeline, not raw
        // post_content, and not run through esc_html() here, that would mangle every tag.
        $content = apply_filters('the_content', $post->post_content);

        return <<<HTML
            <html>
                <body style="font-family: sans-serif;">
                    <h1>{$title}</h1>
                    {$content}
                </body>
            </html>
            HTML;
    }

    public function permission(): bool
    {
        return true;
    }
}
