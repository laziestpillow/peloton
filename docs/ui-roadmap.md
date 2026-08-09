# UI Roadmap

This roadmap is for building the iOS SwiftUI portion of Peloton. The app is fixture-first, so you can make meaningful UI progress without Strava credentials or a running backend.

## Working Rules

- Start from `apps/ios/Peloton.xcodeproj` and run the `Peloton` scheme in fixture mode.
- Keep UI code in `apps/ios/Peloton/Features/*` unless a component is reusable across screens.
- Put reusable visual components in `packages/ios/PelotonDesignSystem`.
- Use models from `packages/ios/PelotonCore`; do not duplicate API/domain models in views.
- Use `FixtureDataClient` from `packages/ios/PelotonFixtures` while building screens.
- Treat `contracts/openapi.yaml` and `contracts/fixtures/*.json` as the source of truth for data shape.
- Keep backend scoring and archetype logic out of SwiftUI.

## Current UI Map

- `App/RootView.swift`: main tab navigation.
- `Features/Garage/GarageView.swift`: rider identity and avatar customization.
- `Features/Activities/ActivitiesView.swift`: imported ride list and sync entry point.
- `Features/Recap/RecapView.swift`: race recap playback surface.
- `Features/Results/ResultsView.swift`: stage, marker, and season results.
- `Features/Authentication/AuthenticationView.swift`: Strava connection placeholder.
- `packages/ios/PelotonDesignSystem/Sources/PelotonDesignSystem/AvatarView.swift`: reusable rider avatar.

## Visual Direction

Use the Tour de France Femmes Race Center as a reference for race-day clarity: compact rankings, live-style updates, prominent stage context, and jersey leader presentation. Treat it as inspiration for information hierarchy and cycling-specific UI patterns, not as a source for copied branding or official race assets.

- [x] Rides: make imported activity rows feel like race-center entries with clear status, distance, elevation, and processed-stage context.
- [x] Results: design jersey leader cards for green, polka dot, and yellow leaders.
- [x] Results: use generic cycling jersey visuals first, then later explore composing a user profile image/avatar above a jersey.
- [x] Recap: use timeline and marker moments to create a live race-center feel.

## Phase 1: Get Comfortable

- [ ] Open the project in Xcode and run the `Peloton` scheme.
- [ ] Change one label or color in each tab to learn where each screen lives.
- [ ] Preview each main screen with Xcode canvas previews.
- [ ] Read `packages/ios/PelotonCore/Sources/PelotonCore/Models.swift` so the fixture data feels less mysterious.
- [ ] Keep a simulator open while editing so visual feedback is immediate.

## Phase 2: Wire Real Fixture Data

- [ ] Create a simple app-level state object that owns a `PelotonDataClient`.
- [ ] Inject `FixtureDataClient()` into the app in fixture mode.
- [x] Replace hard-coded ride rows in `ActivitiesView` with fixture-loaded activities.
- [x] Replace hard-coded result rows in `ResultsView` with fixture-loaded stage results and season standings.
- [x] Replace hard-coded recap riders, leaders, and markers in `RecapView` with fixture-loaded recap data.
- [x] Add loading, empty, and error states for each data-backed screen.

## Phase 3: Build A Shared Design Language

- [x] Move the local `AvatarPreview` in `GarageView` into the design system or replace it with `RiderAvatarView`.
- [ ] Add shared row components for rider rows, activity rows, standings rows, and marker result rows.
- [ ] Define shared spacing, typography, and color helpers in `PelotonDesignSystem`.
- [ ] Make status labels consistent across the app, such as processed, eligible, failed, and syncing.
- [ ] Add a real placeholder app icon before release; the current icon set only exists to unblock builds.

## Phase 4: Improve Each Screen

- [x] Garage: persist unsaved local appearance edits in view state.
- [x] Garage: show reset/save actions and disable save when nothing changed.
- [x] Garage: validate display name length and empty input.
- [x] Rides: add a pull-to-refresh or sync loading state.
- [x] Rides: show processed stage links when `processedStageId` is present.
- [x] Rides: format distance, elevation, and dates from model values instead of strings.
- [x] Recap: map rider positions across the timeline instead of moving a single hard-coded avatar.
- [x] Recap: show marker positions on the elevation/timeline view.
- [x] Recap: make play/pause advance the timeline with respect for Reduce Motion.
- [x] Results: resolve rider IDs to rider display names.
- [x] Results: split stage, marker, and season standings into scan-friendly sections.
- [x] Results: highlight jersey leaders using green, polka dot, and yellow jersey visuals.
- [x] Authentication: keep live Strava auth behind backend-owned flows only.

## Phase 5: Polish And Accessibility

- [ ] Check Dynamic Type sizes on every screen.
- [ ] Check VoiceOver labels for custom avatar and recap visuals.
- [ ] Check light mode and dark mode.
- [ ] Check small iPhone and iPad layouts.
- [ ] Avoid text overlap in rows, buttons, segmented controls, and recap overlays.
- [ ] Add previews for realistic, empty, and error states.

## Phase 6: Verification

- [ ] Run Swift package tests:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test
```

- [ ] Build the iOS app:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project apps/ios/Peloton.xcodeproj -scheme Peloton -configuration Debug -destination 'generic/platform=iOS Simulator' build
```

- [ ] Run backend and contract checks before changing fixture or API data:

```bash
CI=true make lint
CI=true make test
CI=true make contract-check
```

## Suggested First Three Tasks

1. Replace `ActivitiesView` hard-coded rows with fixture data from `FixtureDataClient`.
2. Replace the duplicated `AvatarPreview` with the shared `RiderAvatarView`.
3. Add loading and error states to `ActivitiesView`.

