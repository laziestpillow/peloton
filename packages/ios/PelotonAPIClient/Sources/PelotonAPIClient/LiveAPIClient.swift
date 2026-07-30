import Foundation
import PelotonCore

public struct LiveAPIClient: Sendable {
  private let baseURL: URL
  private let session: URLSession
  private let decoder: JSONDecoder

  public init(baseURL: URL, session: URLSession = .shared) {
    self.baseURL = baseURL
    self.session = session
    decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
  }

  public func activities() async throws -> ActivityListResponse {
    try await get("/v1/activities")
  }

  public func currentRider() async throws -> RiderProfile {
    try await get("/v1/riders/me")
  }

  private func get<T: Decodable>(_ path: String) async throws -> T {
    let url = baseURL.appending(path: path)
    let (data, response) = try await session.data(from: url)
    guard let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode else {
      throw LiveAPIError.unsuccessfulResponse
    }
    return try decoder.decode(T.self, from: data)
  }
}

public enum LiveAPIError: Error {
  case unsuccessfulResponse
}

