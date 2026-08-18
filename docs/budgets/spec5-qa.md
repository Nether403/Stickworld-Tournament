# Spec 5 QA budgets

These are launch ceilings, not baselines to update when a check fails.

## Browser matrix

| Project           | Device          | Coverage                                                    |
| ----------------- | --------------- | ----------------------------------------------------------- |
| `chromium`        | Desktop Chrome  | Full web e2e suite, including the ten-game lazy-load matrix |
| `firefox`         | Desktop Firefox | Catalogue and Hookline practice                             |
| `webkit`          | Desktop Safari  | Catalogue and Hookline practice                             |
| `mobile-webkit`   | iPhone 12       | Catalogue and Hookline practice                             |
| `mobile-chromium` | Pixel 5         | Catalogue and Hookline practice                             |

## Play bundle

| Route                                                            | Baseline gzip bytes |     Ceiling | CI check                             |
| ---------------------------------------------------------------- | ------------------: | ----------: | ------------------------------------ |
| `/play/hookline-sprint` client JS and CSS, excluding Rapier WASM |             569,417 | **683,301** | `node scripts/check-play-bundle.mjs` |

The ceiling remains the Spec 3 baseline multiplied by 1.2. It must not be
silently re-baselined.

## Compressed replay classes

| Class  | Games                             | Compressed ceiling |
| ------ | --------------------------------- | -----------------: |
| tiny   | Hookline, Launch, Archery, Hammer |        5,120 bytes |
| small  | Pickaxe, Pogo                     |       15,360 bytes |
| medium | Rooftop, Bike, Cargo              |       40,960 bytes |
| large  | Demolition                        |       81,920 bytes |

## Replay verification duration

| Fixture         | CI ceiling | Timed operation | CI test                                           |
| --------------- | ---------: | --------------- | ------------------------------------------------- |
| Test Chamber    | < 5,000 ms | `playReplay`    | `packages/platform/tests/verify-duration.test.ts` |
| Hookline Sprint | < 5,000 ms | `playReplay`    | `packages/platform/tests/verify-duration.test.ts` |

The test initializes Rapier, decodes the committed fixture, and constructs the
simulation before starting the timer. It has no database dependency and runs
when `DATABASE_URL` is unset.

## Real-device gates

| Device                 | Games                              | Load time | Frame time | Touch   | Ranked finish | Capture | Status      |
| ---------------------- | ---------------------------------- | --------- | ---------- | ------- | ------------- | ------- | ----------- |
| Real iPhone            | Hookline, Balance Bike, Demolition | pending   | pending    | pending | pending       | pending | **pending** |
| Real mid-range Android | Hookline, Balance Bike, Demolition | pending   | pending    | pending | pending       | pending | **pending** |

These rows remain pending until the Task 6 device walkthrough. Missing
real-device measurements block public launch, not Task 4.
