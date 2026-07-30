import Foundation
import Testing
@testable import PelotonAPIClient

@Test func exposesLiveClientType() {
  let client = LiveAPIClient(baseURL: URL(string: "http://127.0.0.1:8080")!)
  #expect(String(describing: client).contains("LiveAPIClient"))
}

