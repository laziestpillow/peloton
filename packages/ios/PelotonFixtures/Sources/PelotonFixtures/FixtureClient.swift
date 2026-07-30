import Foundation
import PelotonCore

public protocol PelotonDataClient: Sendable {
  func currentRider() async throws -> RiderProfile
  func activities() async throws -> ActivityListResponse
  func recap(stageId: String) async throws -> StageRecap
  func results(stageId: String) async throws -> StageResultsResponse
  func standings(seasonId: String) async throws -> SeasonStandingsResponse
}

public struct FixtureDataClient: PelotonDataClient {
  private let decoder: JSONDecoder
  private let bundle: Bundle

  public init(bundle: Bundle = .module) {
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

  public func activities() async throws -> ActivityListResponse {
    try decode(ActivityListResponse.self, resource: "activities")
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

