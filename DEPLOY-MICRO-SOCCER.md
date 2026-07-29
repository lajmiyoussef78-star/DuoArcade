# Predictive authoritative Micro Soccer v2 deployment

`render.yaml` deploys the Socket.IO service as one always-on instance in Frankfurt.
One instance is intentional: authoritative matches live in server memory until a
shared room store and Socket.IO adapter are introduced.

## Server environment

Set these private values in Render:

- `SUPABASE_URL`: the same Supabase project URL used by the web app.
- `SUPABASE_ANON_KEY`: the project's publishable key, used to validate user JWTs.
- `CORS_ORIGINS`: comma-separated HTTPS web origins, with no trailing slash.

Keep `ROOM_AUTH=required`. Never put a Supabase secret/service-role key in a
`VITE_` variable or in the browser bundle.

## Web app environment

After `/health` reports `ok: true`, configure the production web deployment:

```text
VITE_GAME_RT=socket
VITE_GAME_RT_URL=https://<game-server-host>
VITE_SOC_PREDICTION_MODE=render
VITE_SOC_RENDER_DELAY_MS=100
```

Redeploy the web app after setting the variables. Production
`VITE_GAME_RT_URL` must use the public HTTPS origin, never `127.0.0.1`.
The render-delay setting is retained for `shadow`/`off` fallback and is not
used by predictive rendering.

Deploy the server before the web client because protocol v2 fails closed.
For a canary, set `VITE_SOC_PREDICTION_MODE=shadow`, inspect
`window.__SOC_NET__.summary()`, then switch to `render`. The expected gates are
no protocol mismatches, no unexpected hard resets, contact response within one
frame, and p95 ball correction below 6 px on a stable connection.

## Smoke test

1. Open `/health` and confirm `authoritativeSoccer.protocolVersion` is `2`.
2. Start one Micro Soccer match in two authenticated browser sessions.
3. Confirm both seats receive the same match ID, tick, score, and winner.
4. Disconnect one seat for less than 10 seconds and verify the same match resumes.
5. Play a complete match with 50-150 ms throttled RTT and confirm neither car
   penetrates the ball and the render timeline does not rewind.
