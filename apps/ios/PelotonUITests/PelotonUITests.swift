import XCTest

final class PelotonUITests: XCTestCase {
  func testLaunchShowsGarage() throws {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(app.tabBars.buttons["Garage"].waitForExistence(timeout: 5))
  }
}

