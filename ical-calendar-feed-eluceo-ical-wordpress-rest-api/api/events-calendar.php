<?php

declare(strict_types=1);

use Eluceo\iCal\Domain\Entity\Calendar;
use Eluceo\iCal\Domain\Entity\Event;
use Eluceo\iCal\Domain\ValueObject\DateTime;
use Eluceo\iCal\Domain\ValueObject\Location;
use Eluceo\iCal\Domain\ValueObject\TimeSpan;
use Eluceo\iCal\Domain\ValueObject\UniqueIdentifier;
use Eluceo\iCal\Domain\ValueObject\Uri;
use Eluceo\iCal\Presentation\Factory\CalendarFactory;
use Loopress\Api\Attribute\Permission;

// Serves the site's events as a live .ics feed. Mirrors the cookbook recipe at
// https://docs.loopress.dev/cookbook/documents-and-files/ical-calendar-feed-eluceo-ical-wordpress-rest-api/.
#[Permission(public: true)]
class EventsCalendar
{
    public function get(): void
    {
        $utc    = new DateTimeZone('UTC');
        $events = [];

        foreach (get_posts(['post_type' => 'event', 'post_status' => 'publish', 'numberposts' => 100]) as $post) {
            $start = get_post_meta($post->ID, 'start_date', true);
            $end   = get_post_meta($post->ID, 'end_date', true);

            if ($start === '' || $end === '') {
                continue;
            }

            $event = (new Event(new UniqueIdentifier('event-' . $post->ID . '@' . wp_parse_url(home_url(), PHP_URL_HOST))))
                ->setSummary(html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'))
                ->setUrl(new Uri(get_permalink($post)))
                ->setOccurrence(new TimeSpan(
                    new DateTime((new DateTimeImmutable($start, wp_timezone()))->setTimezone($utc), true),
                    new DateTime((new DateTimeImmutable($end, wp_timezone()))->setTimezone($utc), true),
                ));

            $venue = get_post_meta($post->ID, 'venue', true);
            if ($venue !== '') {
                $event->setLocation(new Location($venue));
            }

            $events[] = $event;
        }

        $calendar = (new CalendarFactory())->createCalendar(new Calendar($events));

        header('Content-Type: text/calendar; charset=utf-8');
        header('Content-Disposition: inline; filename="events.ics"');
        echo $calendar;
        exit;
    }
}
