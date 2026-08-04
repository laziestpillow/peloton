import Foundation
import PelotonCore

public struct LiveAPIClient: Sendable {
  private let baseURL: URL
  private let session: URLSession
  private let bearerToken: @Sendable () async -> String?
  private let decoder: JSONDecoder
  private let encoder: JSONEncoder

  public init(baseURL: URL, session: URLSession = .shared, bearerToken: @escaping @Sendable () async -> String? = { nil }) {
    self.baseURL = baseURL
    self.session = session
    self.bearerToken = bearerToken
    decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
  }

  public func startStravaAuthorization() async throws -> StravaAuthorizationStart {
    try await request("POST", "/v1/auth/strava/start")
  }

  public func stravaStatus() async throws -> StravaIntegrationStatus {
    try await request("GET", "/v1/integrations/strava/status")
  }

  public func stravaConsentInfo() async throws -> StravaConsentInfo {
    try await request("GET", "/v1/integrations/strava/consent")
  }

  public func disconnectStrava() async throws {
    try await requestNoContent("DELETE", "/v1/integrations/strava")
  }

  public func deleteStravaData() async throws {
    try await requestNoContent("DELETE", "/v1/integrations/strava/data")
  }

  public func syncActivities(idempotencyKey: String = UUID().uuidString) async throws -> ActivitySyncResponse {
    try await request("POST", "/v1/activities/sync", idempotencyKey: idempotencyKey)
  }

  public func activities() async throws -> ActivityListResponse {
    try await request("GET", "/v1/activities")
  }

  public func activity(id: String) async throws -> ImportedActivity {
    try await request("GET", "/v1/activities/\(id)")
  }

  public func currentRider() async throws -> RiderProfile {
    try await request("GET", "/v1/riders/me")
  }

  public func updateCurrentRiderAppearance(_ appearance: RiderAppearance, idempotencyKey: String = UUID().uuidString) async throws -> RiderProfile {
    try await request("PATCH", "/v1/riders/me/appearance", body: appearance, idempotencyKey: idempotencyKey)
  }

  public func createGroup(name: String, idempotencyKey: String = UUID().uuidString) async throws -> Group {
    try await request("POST", "/v1/groups", body: CreateGroupRequest(name: name), idempotencyKey: idempotencyKey)
  }

  public func group(id: String) async throws -> Group {
    try await request("GET", "/v1/groups/\(id)")
  }

  public func addGroupMember(groupId: String, riderId: String, idempotencyKey: String = UUID().uuidString) async throws -> GroupMembership {
    try await request("POST", "/v1/groups/\(groupId)/members", body: AddGroupMemberRequest(riderId: riderId), idempotencyKey: idempotencyKey)
  }

  public func stages(groupId: String) async throws -> StageListResponse {
    try await request("GET", "/v1/groups/\(groupId)/stages")
  }

  public func stage(id: String) async throws -> Stage {
    try await request("GET", "/v1/stages/\(id)")
  }

  public func recap(stageId: String) async throws -> StageRecap {
    try await request("GET", "/v1/stages/\(stageId)/recap")
  }

  public func results(stageId: String) async throws -> StageResultsResponse {
    try await request("GET", "/v1/stages/\(stageId)/results")
  }

  public func standings(seasonId: String) async throws -> SeasonStandingsResponse {
    try await request("GET", "/v1/seasons/\(seasonId)/standings")
  }

  public func archetypes(seasonId: String) async throws -> SeasonArchetypesResponse {
    try await request("GET", "/v1/seasons/\(seasonId)/archetypes")
  }

  private func request<T: Decodable, Body: Encodable>(
    _ method: String,
    _ path: String,
    body: Body? = Optional<Data>.none,
    idempotencyKey: String? = nil
  ) async throws -> T {
    var request = try await makeRequest(method, path, idempotencyKey: idempotencyKey)
    if let body {
      request.httpBody = try encoder.encode(body)
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    let (data, response) = try await session.data(for: request)
    try validate(response: response, data: data)
    return try decoder.decode(T.self, from: data)
  }

  private func request<T: Decodable>(_ method: String, _ path: String, idempotencyKey: String? = nil) async throws -> T {
    let request = try await makeRequest(method, path, idempotencyKey: idempotencyKey)
    let (data, response) = try await session.data(for: request)
    try validate(response: response, data: data)
    return try decoder.decode(T.self, from: data)
  }

  private func requestNoContent(_ method: String, _ path: String, idempotencyKey: String? = nil) async throws {
    let request = try await makeRequest(method, path, idempotencyKey: idempotencyKey)
    let (data, response) = try await session.data(for: request)
    try validate(response: response, data: data)
  }

  private func makeRequest(_ method: String, _ path: String, idempotencyKey: String?) async throws -> URLRequest {
    var request = URLRequest(url: baseURL.appending(path: path))
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token = await bearerToken(), !token.isEmpty {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    if let idempotencyKey {
      request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
    }
    return request
  }

  private func validate(response: URLResponse, data: Data) throws {
    guard let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode else {
      let error = try? decoder.decode(ErrorResponse.self, from: data)
      throw LiveAPIError.unsuccessfulResponse(statusCode: (response as? HTTPURLResponse)?.statusCode, error: error)
    }
  }
}

private struct CreateGroupRequest: Encodable {
  let name: String
}

private struct AddGroupMemberRequest: Encodable {
  let riderId: String
}

public enum LiveAPIError: Error, Equatable {
  case unsuccessfulResponse(statusCode: Int?, error: ErrorResponse?)
}
