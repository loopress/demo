<?php

declare(strict_types=1);

// Headless use case: a form on a separate frontend (Next.js/Astro) posts here
// anonymously. Overriding permission() to public is an explicit, conscious
// choice (default stays manage_options otherwise), and headers() is what a
// client-side fetch() from a different origin needs for CORS. Neither is
// required for a same-origin call or a server-side call (getServerSideProps,
// Astro frontmatter): see obsidian/Product/Custom API Routes.md "CORS".
final class NewsletterSignup
{
    public function post(WP_REST_Request $request): array
    {
        $email = (string) $request->get_param('email');

        if ($email === '' || !str_contains($email, '@')) {
            return ['error' => 'A valid email is required'];
        }

        // TODO: hook this up to your actual mailing list provider.
        return ['subscribed' => $email];
    }

    public function permission(): callable
    {
        return fn(): bool => true;
    }

    public function headers(): array
    {
        return ['Access-Control-Allow-Origin' => 'https://example.com'];
    }
}
