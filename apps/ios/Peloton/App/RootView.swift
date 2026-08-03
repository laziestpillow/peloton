import SwiftUI

struct RootView: View {
  let store: AppStore

  var body: some View {
    TabView {
      GarageView(store: store)
        .tabItem { Label("Garage", systemImage: "person.crop.circle") }
      ActivitiesView(store: store)
        .tabItem { Label("Rides", systemImage: "bicycle") }
      RecapView(store: store)
        .tabItem { Label("Recap", systemImage: "play.circle") }
      ResultsView(store: store)
        .tabItem { Label("Results", systemImage: "list.number") }
    }
    .task {
      await store.loadInitialData()
    }
    .overlay(alignment: .bottom) {
      if let message = store.errorMessage {
        Text(message)
          .font(.footnote)
          .padding(10)
          .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
          .padding()
          .accessibilityLabel("Error \(message)")
      }
    }
  }
}

#Preview {
  RootView(store: AppStore.makeDefault())
}
