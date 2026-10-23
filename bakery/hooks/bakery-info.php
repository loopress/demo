<?php
declare(strict_types=1);

use Loopress\Hooks\Attribute\Action;

/**
 * [bakery_hours] and [bakery_phone]: the opening hours and phone number of the `bakery_info`
 * option (options/bakery_info.json), so pages and footer never repeat them.
 */
final class BakeryInfo
{
    #[Action('init')]
    public function registerShortcodes(): void
    {
        add_shortcode('bakery_hours', [$this, 'hours']);
        add_shortcode('bakery_phone', fn (): string => esc_html($this->info('phone')));
    }

    /** `[bakery_hours]` is a table, `[bakery_hours format="inline"]` one sentence. */
    public function hours(array|string $atts = []): string
    {
        $atts = shortcode_atts(['format' => 'table'], $atts);
        $closed = esc_html($this->info('closed_day'));
        $weekdays = esc_html($this->info('weekday_hours'));
        $sunday = esc_html($this->info('sunday_hours'));

        if ($atts['format'] === 'inline') {
            return "Tuesday to Saturday {$weekdays}, Sunday {$sunday}. Closed on {$closed}.";
        }

        return '<table class="c-hours">'
            . "<tr><th>{$closed}</th><td>Closed</td></tr>"
            . "<tr><th>Tuesday to Saturday</th><td>{$weekdays}</td></tr>"
            . "<tr><th>Sunday</th><td>{$sunday}</td></tr>"
            . '</table>';
    }

    private function info(string $key): string
    {
        $info = get_option('bakery_info', []);

        return is_array($info) ? (string) ($info[$key] ?? '') : '';
    }
}
