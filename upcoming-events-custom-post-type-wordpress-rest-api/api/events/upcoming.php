<?php

declare(strict_types=1);

// Lists the events that have not ended yet, soonest first, for a theme, a headless front end or
// a newsletter. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/site-as-code/upcoming-events-custom-post-type-wordpress-rest-api/.
class UpcomingEvents
{
    private const MAX_PER_PAGE = 50;

    public function get(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $perPage = $request->get_param('per_page') ?? '10';
        if (!is_string($perPage) || !ctype_digit($perPage)) {
            return new WP_Error('invalid_per_page', 'per_page must be a whole number.', ['status' => 400]);
        }

        $page = $request->get_param('page') ?? '1';
        if (!is_string($page) || !ctype_digit($page) || (int) $page < 1) {
            return new WP_Error('invalid_page', 'page must be a whole number, 1 or more.', ['status' => 400]);
        }

        $query = [
            'post_type'      => 'event',
            'post_status'    => 'publish',
            'posts_per_page' => max(1, min(self::MAX_PER_PAGE, (int) $perPage)),
            'paged'          => (int) $page,
            'no_found_rows'  => true,
            'meta_query'     => [
                // Still on: an event already started but not finished stays in the list.
                'not_ended' => [
                    'key'     => 'end_date',
                    'value'   => current_time('mysql'),
                    'compare' => '>=',
                    'type'    => 'DATETIME',
                ],
                'starts' => ['key' => 'start_date', 'type' => 'DATETIME'],
            ],
            'orderby' => ['starts' => 'ASC', 'ID' => 'ASC'],
        ];

        $type = $request->get_param('type');
        if ($type !== null) {
            $term = is_string($type) ? get_term_by('slug', $type, 'event-type') : false;
            if (!$term instanceof WP_Term) {
                return new WP_Error('invalid_type', 'No event type with that slug.', ['status' => 400]);
            }
            $query['tax_query'] = [['taxonomy' => 'event-type', 'terms' => $term->term_id]];
        }

        $events = array_map([$this, 'format'], (new WP_Query($query))->posts);

        $response = new WP_REST_Response($events);
        $response->header('Cache-Control', 'public, max-age=300');

        return $response;
    }

    // Published events are public, the route is too: a front end calls it without an account.
    public function permission(WP_REST_Request $request): bool
    {
        return true;
    }

    private function format(WP_Post $event): array
    {
        $types = get_the_terms($event, 'event-type');

        return [
            'id'         => $event->ID,
            'title'      => get_the_title($event),
            'link'       => get_permalink($event),
            'start_date' => $this->isoDate(get_post_meta($event->ID, 'start_date', true)),
            'end_date'   => $this->isoDate(get_post_meta($event->ID, 'end_date', true)),
            'venue'      => (string) get_post_meta($event->ID, 'venue', true),
            'types'      => is_array($types) ? wp_list_pluck($types, 'slug') : [],
        ];
    }

    // "2026-12-05 19:30:00" in the site's timezone to "2026-12-05T19:30:00+01:00". An empty or
    // malformed value gives null, never a made-up date.
    private function isoDate(mixed $value): ?string
    {
        $date = is_string($value) ? DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $value, wp_timezone()) : false;

        return $date === false ? null : $date->format(DATE_ATOM);
    }
}
