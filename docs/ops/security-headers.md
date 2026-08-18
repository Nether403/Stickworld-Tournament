# Security headers

`apps/web/next.config.ts` applies the launch security policy to every route.

The Content Security Policy keeps network access to the application, the configured Neon Auth
origin, and Google Accounts. It intentionally excludes Gemini, Deepgram, OpenRouter, and other AI
service hosts.

Two narrow execution exceptions are documented:

- `style-src 'unsafe-inline'` is required by the current Next.js and Phaser rendering stack.
- `script-src 'wasm-unsafe-eval'` permits Rapier WebAssembly compilation without enabling the
  broader `'unsafe-eval'` source.

Framing, camera, microphone, and geolocation are disabled. Referrers are reduced to origins on
cross-origin requests, and MIME sniffing is disabled.
