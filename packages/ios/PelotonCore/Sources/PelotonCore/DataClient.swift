public protocol PelotonDataClient: Sendable {
  func startStravaAuthorization() async throws -> StravaAuthorizationStart
  func stravaStatus() async throws -> StravaIntegrationStatus
  func stravaConsentInfo() async throws -> StravaConsentInfo
  func disconnectStrava() async throws
  func deleteStravaData() async throws
  func syncActivities(idempotencyKey: String) async throws -> ActivitySyncResponse
  func currentRider() async throws -> RiderProfile
  func updateCurrentRiderAppearance(_ appearance: RiderAppearance, idempotencyKey: String) async throws -> RiderProfile
  func activities() async throws -> ActivityListResponse
  func stages(groupId: String) async throws -> StageListResponse
  func recap(stageId: String) async throws -> StageRecap
  func results(stageId: String) async throws -> StageResultsResponse
  func standings(seasonId: String) async throws -> SeasonStandingsResponse
  func archetypes(seasonId: String) async throws -> SeasonArchetypesResponse
}
