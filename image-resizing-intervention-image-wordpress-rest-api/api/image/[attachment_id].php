<?php

declare(strict_types=1);

use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Loopress\Api\Attribute\Permission;

#[Permission(public: true)]
class Image
{
    public function get(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $attachmentId = (int) $request->get_param('attachment_id');
        $path         = get_attached_file($attachmentId);

        if ($path === false || !file_exists($path)) {
            return new WP_Error('not_found', 'No attachment with that id.', ['status' => 404]);
        }

        $width  = (int) ($request->get_param('width') ?: 400);
        $height = (int) ($request->get_param('height') ?: 400);

        $manager = new ImageManager(new Driver());
        $image   = $manager->read($path);
        $image->cover($width, $height); // resize + crop to exactly fill the box, no distortion

        $encoded = $image->toWebp(80);

        $response = new WP_REST_Response([
            'width'    => $width,
            'height'   => $height,
            'data_uri' => 'data:image/webp;base64,' . base64_encode((string) $encoded),
        ]);
        $response->header('Cache-Control', 'public, max-age=86400');

        return $response;
    }
}
