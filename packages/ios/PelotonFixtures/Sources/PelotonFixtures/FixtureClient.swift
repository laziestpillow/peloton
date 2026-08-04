import Foundation
import PelotonCore

public protocol PelotonDataClient: Sendable {
  func startStravaAuthorization() async throws -> StravaAuthorizationStart
  func stravaStatus() async throws -> StravaIntegrationStatus
  func disconnectStrava() async throws
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

public struct FixtureDataClient: PelotonDataClient {
  private let decoder: JSONDecoder
  private let bundle: Bundle

  public init() {
    self.init(bundle: .module)
  }

  public init(bundle: Bundle) {
    self.bundle = bundle
    decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
  }

  public func currentRider() async throws -> RiderProfile {
    let recap = try decode(StageRecap.self, resource: "recap")
    guard let rider = recap.riders.first else {
      throw FixtureError.missingRider
    }
    return rider
  }

  public func startStravaAuthorization() async throws -> StravaAuthorizationStart {
    try decode(StravaAuthorizationStart.self, resource: "strava-auth-start")
  }

  public func stravaStatus() async throws -> StravaIntegrationStatus {
    try decode(StravaIntegrationStatus.self, resource: "strava-status")
  }

  public func disconnectStrava() async throws {}

  public func syncActivities(idempotencyKey: String) async throws -> ActivitySyncResponse {
    try decode(ActivitySyncResponse.self, resource: "activity-sync")
  }

  public func updateCurrentRiderAppearance(_ appearance: RiderAppearance, idempotencyKey: String) async throws -> RiderProfile {
    var rider = try await currentRider()
    rider.appearance = appearance
    return rider
  }

  public func activities() async throws -> ActivityListResponse {
    try decode(ActivityListResponse.self, resource: "activities")
  }

  public func stages(groupId: String) async throws -> StageListResponse {
    try decode(StageListResponse.self, resource: "stages")
  }

  public func recap(stageId: String) async throws -> StageRecap {
    try decode(StageRecap.self, resource: "recap")
  }

  public func results(stageId: String) async throws -> StageResultsResponse {
    try decode(StageResultsResponse.self, resource: "stage-results")
  }

  public func standings(seasonId: String) async throws -> SeasonStandingsResponse {
    try decode(SeasonStandingsResponse.self, resource: "season-standings")
  }

  public func archetypes(seasonId: String) async throws -> SeasonArchetypesResponse {
    try decode(SeasonArchetypesResponse.self, resource: "archetypes")
  }

  private func decode<T: Decodable>(_ type: T.Type, resource: String) throws -> T {
    guard let url = bundle.url(forResource: resource, withExtension: "json") else {
      throw FixtureError.missingResource(resource)
    }
    let data = try Data(contentsOf: url)
    return try decoder.decode(type, from: data)
  }
}

public enum FixtureError: Error, Equatable {
  case missingResource(String)
  case missingRider
}
