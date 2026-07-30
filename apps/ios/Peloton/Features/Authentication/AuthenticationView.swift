import SwiftUI

struct AuthenticationView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Strava")
        .font(.title2.weight(.semibold))
      Text("Fixture mode is active. Live Strava authorization is handled by the backend and opens through ASWebAuthenticationSession.")
        .font(.callout)
        .foregroundStyle(.secondary)
      Button("Connect Strava") {}
        .buttonStyle(.borderedProminent)
        .accessibilityLabel("Connect Strava")
    }
    .padding()
  }
}

