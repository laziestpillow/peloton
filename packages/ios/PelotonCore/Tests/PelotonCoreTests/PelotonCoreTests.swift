import Testing
@testable import PelotonCore

@Test func garageTracksUnsavedAppearanceChanges() {
  let profile = RiderProfile(
    id: "rider-001",
    userId: "user-001",
    displayName: "Marta",
    appearance: RiderAppearance(jerseyColor: "#2F80ED", accentColor: "#F2C94C", helmetColor: "#FFFFFF", bikeColor: "#111111", pattern: .stripes),
    createdAt: .distantPast,
    updatedAt: .distantPast
  )

  let state = GarageState(profile: profile)
  state.updateAppearance(RiderAppearance(jerseyColor: "#27AE60", accentColor: "#F2C94C", helmetColor: "#FFFFFF", bikeColor: "#111111", pattern: .solid))

  #expect(state.hasUnsavedChanges)
  #expect(state.appearance.pattern == .solid)
}

@Test func recapScrubbingClampsToDuration() {
  let state = RecapPlaybackState()
  state.scrub(to: 500, duration: 120)
  #expect(state.currentTimeSeconds == 120)
}

