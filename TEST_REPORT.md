# GoPlan — second verification report

Date: 2026-11-20

## Summary

A second review found and fixed two application-logic defects:

1. **Plan edit validation:** `saveEdit()` changed the plan title/area/memo/photos before checking whether the required date was present. If the date was blank, the save was rejected but the in-memory record had already changed. The date is now validated before any record mutation.
2. **Shared theme adoption:** when a device-only theme override was turned off, the UI said the shared theme would be adopted, but the selected device theme was instead written as the shared theme. Turning off an existing device-only override now applies the locally cached shared theme and does not publish the former device-only selection.

## Checks passed

- Inline application JavaScript parsed with `node --check`.
- Service worker JavaScript parsed with `node --check`.
- HTML parsed; 115 IDs are unique; all 99 direct `$()` element references resolve.
- `manifest.webmanifest` parsed as JSON and both declared icons exist.
- Every local static reference and every service-worker cache asset path exists.
- PNG brand assets opened and passed image integrity checks.
- No obvious hard-coded API keys or private keys were found in the app source.
- Chromium UI simulation at 1365 px, 390 px, and 320 px viewport widths.
- No horizontal overflow at those three viewport widths.
- Wish creation, plan creation, moving a wish to a plan, and calendar rendering.
- Photo compression/picker flow, three-photo maximum, and photo removal.
- Invalid plan-date edit is rejected without mutating the stored plan.
- All four theme presets, dark mode, and restoring the cached shared theme after disabling a device-only override.
- Separate Home and Plans wallpapers.
- PLANI name and “GoPlan AI” label.
- Local backup retention (latest five), restore of the oldest retained snapshot, and backup-before-delete flow.
- Google identity/Drive flow using mocked responses: account email display, new-file POST with `appDataFolder` metadata, and existing-file PATCH without `parents` metadata.
- Malformed local data/settings recover to safe in-memory defaults.
- Zero browser page errors and zero console errors in the simulated UI runs.

## Test setup and limitations

The UI tests ran in Chromium with test shims for local storage, IndexedDB, Google OAuth, and Google Drive. These shims exercise the app's UI and request construction, but **they are not a live Google account or real Drive service**. The standard browser launch/navigation route was blocked by the execution environment, so service-worker installation and offline navigation could not be validated on a live origin.

The following still require a real deployment/device test:

- Google OAuth with the actual OAuth client ID and a real Google account.
- Actual Google Drive appData access and two-device behavior.
- PWA installation and offline opening on iPhone/Android.
- Real-device IndexedDB quota and storage behavior.

## Known limitations (not represented as passing tests)

- PLANI AI chat/search/plan generation is not active; it needs a secure backend/API connection.
- Scheduled place monitoring and push notifications are not active; they need backend scheduling and push infrastructure.
- Automatic backups currently stay in each browser/device's IndexedDB; they are not cloud backups.
- Simultaneous offline edits on multiple devices are not merged. Drive sync currently uses timestamps and effectively follows last-writer-wins behavior, so avoid editing the same GoPlan data on multiple devices while they are disconnected until conflict-aware merging is implemented.

This report records the checks actually run. It is not a guarantee that every possible browser, operating system, or device is bug-free.
