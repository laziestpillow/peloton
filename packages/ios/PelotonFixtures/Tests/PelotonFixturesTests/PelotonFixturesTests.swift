import Testing
@testable import PelotonFixtures

@Test func decodesFixtureRider() async throws {
  let client = FixtureDataClient()
  let rider = try await client.currentRider()
  #expect(rider.displayName == "Marta")
}

@Test func decodesFixtureActivities() async throws {
  let client = FixtureDataClient()
  let activities = try await client.activities()
  #expect(activities.data.first?.id == "activity-001")
}

