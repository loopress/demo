<?php

declare(strict_types=1);

use Stripe\Event;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class StripeWebhook
{
    private ?Event $event = null;

    public function permission(WP_REST_Request $request): bool
    {
        $secret = defined('STRIPE_WEBHOOK_SECRET') ? (string) STRIPE_WEBHOOK_SECRET : (string) get_option('stripe_webhook_secret');

        // An empty secret would let anyone sign a payload with an empty key: refuse instead.
        if ($secret === '') {
            return false;
        }

        try {
            $this->event = Webhook::constructEvent($request->get_body(), (string) $request->get_header('stripe-signature'), $secret);
        } catch (\UnexpectedValueException | SignatureVerificationException) {
            return false;
        }

        return true;
    }

    public function post(): array
    {
        // permission() already ran on this same instance and verified the event.
        if ($this->event === null) {
            return ['ok' => false];
        }

        if ($this->event->type === 'checkout.session.completed') {
            $orderId = (int) ($this->event->data->object->metadata->order_id ?? 0);

            if ($orderId > 0 && get_post($orderId) !== null) {
                update_post_meta($orderId, '_payment_status', 'paid');
            }
        }

        return ['ok' => true, 'type' => $this->event->type];
    }
}
