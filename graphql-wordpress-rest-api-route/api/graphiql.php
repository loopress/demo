<?php

declare(strict_types=1);

// api/graphql.php only accepts POST, nothing a browser can explore by itself. GraphiQL is
// the standard interactive client for exactly that: point it at the same endpoint, type a
// query against the real schema, see the real response. CDN embed, the same approach
// GraphiQL's own examples repo documents for its current major version: an import map
// resolving React/GraphiQL as ES modules from esm.sh, no build step, no separate npm
// project (the older single-file unpkg UMD bundle, graphiql.min.js exposing a global
// GraphiQL, was dropped starting with GraphiQL 5). The default query targets the most
// recently published post, not a fixed id: whatever this site's own content happens to
// be, the playground opens on something that actually resolves.
final class GraphiqlRoute
{
    public function get(): void
    {
        $latest = get_posts(['post_type' => 'post', 'numberposts' => 1, 'orderby' => 'ID', 'order' => 'DESC']);
        $postId = $latest === [] ? 0 : $latest[0]->ID;

        $endpointJson = wp_json_encode(esc_url_raw(rest_url('loopress-api/v1/graphql')));
        $queryJson = wp_json_encode(sprintf(
            "query {\n  post(id: \"%d\") {\n    title\n    readingTime\n    summary\n  }\n}",
            $postId
        ));

        header('Content-Type: text/html; charset=utf-8');
        echo <<<HTML
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8" />
        <title>GraphiQL</title>
        <style>body { margin: 0; } #graphiql { height: 100dvh; }</style>
        <link rel="stylesheet" href="https://esm.sh/graphiql@5.4.0/dist/style.css" />
        <script type="importmap">
        {
          "imports": {
            "react": "https://esm.sh/react@19.2.8",
            "react/": "https://esm.sh/react@19.2.8/",
            "react-dom": "https://esm.sh/react-dom@19.2.8",
            "react-dom/": "https://esm.sh/react-dom@19.2.8/",
            "graphiql": "https://esm.sh/graphiql@5.4.0?standalone&external=react,react-dom,@graphiql/react,graphql",
            "graphiql/": "https://esm.sh/graphiql@5.4.0/",
            "@graphiql/react": "https://esm.sh/@graphiql/react@0.39.0?standalone&external=react,react-dom,graphql,@graphiql/toolkit,@emotion/is-prop-valid",
            "@graphiql/toolkit": "https://esm.sh/@graphiql/toolkit@0.12.1?standalone&external=graphql",
            "graphql": "https://esm.sh/graphql@17.0.2",
            "@emotion/is-prop-valid": "data:text/javascript,"
          }
        }
        </script>
        </head>
        <body>
        <div id="graphiql">Loading GraphiQL...</div>
        <script type="module">
          import React from 'react';
          import ReactDOM from 'react-dom/client';
          import { GraphiQL } from 'graphiql';
          import { createGraphiQLFetcher } from '@graphiql/toolkit';
          import 'graphiql/setup-workers/esm.sh';

          const fetcher = createGraphiQLFetcher({ url: {$endpointJson} });
          const root = ReactDOM.createRoot(document.getElementById('graphiql'));
          root.render(React.createElement(GraphiQL, { fetcher, defaultQuery: {$queryJson} }));
        </script>
        </body>
        </html>
        HTML;
        exit;
    }

    public function permission(): bool
    {
        return true;
    }
}
