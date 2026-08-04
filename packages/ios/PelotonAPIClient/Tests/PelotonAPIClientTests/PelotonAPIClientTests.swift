import Foundation
import PelotonCore
import Testing
@testable import PelotonAPIClient

@Suite(.serialized)
struct LiveAPIClientTests {
  @Test func sendsBearerAndIdempotencyHeaders() async throws {
    MockURLProtocol.handler = { request in
      #expect(request.httpMethod == "POST")
      #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
      #expect(request.value(forHTTPHeaderField: "Idempotency-Key") == "sync-key-001")
      return (
        HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!,
        #"{"status":"accepted","requestedAt":"2026-07-31T10:00:00Z"}"#.data(using: .utf8)!
      )
    }
    defer { MockURLProtocol.handler = nil }

    let client = LiveAPIClient(baseURL: URL(string: "http://127.0.0.1:8080")!, session: mockSession, bearerToken: { "test-token" })
    let response = try await client.syncActivities(idempotencyKey: "sync-key-001")

    #expect(response.status == "accepted")
  }

  @Test func decodesContractErrors() async throws {
    MockURLProtocol.handler = { request in
      (
        HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!,
        #"{"error":{"code":"unauthorized","message":"Missing bearer token.","requestId":"request-001"}}"#.data(using: .utf8)!
      )
    }
    defer { MockURLProtocol.handler = nil }

    let client = LiveAPIClient(baseURL: URL(string: "http://127.0.0.1:8080")!, session: mockSession)

    do {
      _ = try await client.currentRider()
    } catch let error as LiveAPIError {
      guard case .unsuccessfulResponse(let statusCode, let response) = error else {
        Issue.record("Expected unsuccessful response error")
        return
      }
      #expect(statusCode == 401)
      #expect(response?.error.code == "unauthorized")
      #expect(response?.error.message == "Missing bearer token.")
      #expect(response?.error.requestId == "request-001")
      return
    }

    Issue.record("Expected LiveAPIError")
  }

  @Test func encodesAppearancePatchBody() async throws {
    MockURLProtocol.handler = { request in
      #expect(request.httpMethod == "PATCH")
      #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
      let body = request.bodyData.flatMap { String(data: $0, encoding: .utf8) } ?? ""
      #expect(body.contains("\"jerseyColor\":\"#000000\""))
      return (
        HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
        """
        {
          "id": "rider-001",
          "userId": "user-001",
          "displayName": "Marta",
          "appearance": {
            "jerseyColor": "#000000",
            "accentColor": "#FFFFFF",
            "helmetColor": "#111111",
            "bikeColor": "#222222",
            "pattern": "solid"
          },
          "createdAt": "2026-07-01T10:00:00Z",
          "updatedAt": "2026-07-20T10:00:00Z"
        }
        """.data(using: .utf8)!
      )
    }
    defer { MockURLProtocol.handler = nil }

    let client = LiveAPIClient(baseURL: URL(string: "http://127.0.0.1:8080")!, session: mockSession)
    let rider = try await client.updateCurrentRiderAppearance(
      RiderAppearance(jerseyColor: "#000000", accentColor: "#FFFFFF", helmetColor: "#111111", bikeColor: "#222222", pattern: .solid),
      idempotencyKey: "appearance-key"
    )

    #expect(rider.appearance.pattern == .solid)
  }
}

private var mockSession: URLSession {
  let configuration = URLSessionConfiguration.ephemeral
  configuration.protocolClasses = [MockURLProtocol.self]
  return URLSession(configuration: configuration)
}

private final class MockURLProtocol: URLProtocol, @unchecked Sendable {
  nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

  override class func canInit(with request: URLRequest) -> Bool {
    true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    guard let handler = Self.handler else {
      client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
      return
    }

    do {
      let (response, data) = try handler(request)
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}
}

private extension URLRequest {
  var bodyData: Data? {
    if let httpBody {
      return httpBody
    }
    guard let httpBodyStream else {
      return nil
    }
    httpBodyStream.open()
    defer { httpBodyStream.close() }

    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 1024)
    while httpBodyStream.hasBytesAvailable {
      let count = httpBodyStream.read(&buffer, maxLength: buffer.count)
      if count > 0 {
        data.append(buffer, count: count)
      } else {
        break
      }
    }
    return data
  }
}
