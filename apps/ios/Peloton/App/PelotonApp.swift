import SwiftUI

@main
struct PelotonApp: App {
  @State private var store = AppStore.makeDefault()

  var body: some Scene {
    WindowGroup {
      RootView(store: store)
    }
  }
}
