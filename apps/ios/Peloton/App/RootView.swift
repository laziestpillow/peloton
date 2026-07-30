import SwiftUI

struct RootView: View {
  var body: some View {
    TabView {
      GarageView()
        .tabItem { Label("Garage", systemImage: "person.crop.circle") }
      ActivitiesView()
        .tabItem { Label("Rides", systemImage: "bicycle") }
      RecapView()
        .tabItem { Label("Recap", systemImage: "play.circle") }
      ResultsView()
        .tabItem { Label("Results", systemImage: "list.number") }
    }
  }
}

#Preview {
  RootView()
}

