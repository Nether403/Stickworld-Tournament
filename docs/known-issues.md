# Known issues

- No announcer VO at launch; gameplay ships silent.
- Presentation art can differ from the authoritative colliders in some courses.
  Collision geometry remains the source of truth, so a visible edge may not
  perfectly match where contact occurs.
- Some presentation paths still use cubic P2 curves. These are visual-only PR
  #4 leftovers and do not alter the fixed-tick simulation or ranked scoring.
- Real-device QA captures are pending for Hookline Sprint, Balance Bike Blitz,
  and Demolition Dive on a real iPhone and a mid-range Android device. No
  physical phone has been marked as passed; see `docs/ops/device-qa.md`.
