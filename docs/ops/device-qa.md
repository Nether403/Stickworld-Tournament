# Real-device QA checklist

Status: **pending**. Complete this checklist during the Task 6 walkthrough.
Do not mark a device or game as passed without a dated screen recording.

## Capture metadata

For each real iPhone and mid-range Android capture:

- [ ] Record device model, OS version, browser, and browser version.
- [ ] Record build commit and environment URL.
- [ ] Record network conditions and the measured load time for each game.
- [ ] Start the screen recording before opening the first game.
- [ ] Keep the game, touch controls, and completed run visible in the capture.
- [ ] Add the dated walkthrough artifact link to the results table.

## Game checks

Run all checks on both devices.

### Hookline Sprint

- [ ] `/play/hookline-sprint` loads without a visible error.
- [ ] Frame time remains playable through a complete practice run.
- [ ] Attach, reel, release, and direction touch controls respond correctly.
- [ ] The viewport has no clipped controls or horizontal scrolling.
- [ ] Complete a ranked finish when a test account is available; otherwise
      record `not run — no test account`, not `passed`.

### Balance Bike Blitz

- [ ] `/play/balance-bike-blitz` loads without a visible error.
- [ ] Frame time remains playable through a complete practice run.
- [ ] Throttle, brake, and lean touch controls respond correctly.
- [ ] The viewport has no clipped controls or horizontal scrolling.

### Demolition Dive

- [ ] `/play/demolition-dive` loads without a visible error.
- [ ] Frame time remains playable through a complete practice run.
- [ ] Aim, power, and release touch controls respond correctly.
- [ ] The viewport has no clipped controls or horizontal scrolling.

## Results

| Device                 | Hookline | Balance Bike | Demolition | Capture | Status      |
| ---------------------- | -------- | ------------ | ---------- | ------- | ----------- |
| Real iPhone            | pending  | pending      | pending    | pending | **pending** |
| Real mid-range Android | pending  | pending      | pending    | pending | **pending** |
