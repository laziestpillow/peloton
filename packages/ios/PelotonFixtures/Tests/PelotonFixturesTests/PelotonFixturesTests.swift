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

@Test func decodesFixtureStagesAndArchetypes() async throws {
  let client = FixtureDataClient()
  let stages = try await client.stages(groupId: "group-001")
  let archetypes = try await client.archetypes(seasonId: "season-001")

  #expect(stages.data.first?.id == "stage-001")
  #expect(archetypes.data.first?.archetype == "rookie")
}
