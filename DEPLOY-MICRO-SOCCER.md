# Authoritative Micro Soccer deployment

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
VITE_SOC_RENDER_DELAY_MS=100
```

Redeploy the web app after setting the variables. Production
`VITE_GAME_RT_URL` must use the public HTTPS origin, never `127.0.0.1`.

## Smoke test

1. Open `/health` and confirm `authoritativeSoccer` is present.
2. Start one Micro Soccer match in two authenticated browser sessions.
3. Confirm both seats receive the same match ID, tick, score, and winner.
4. Disconnect one seat for less than 10 seconds and verify the same match resumes.
