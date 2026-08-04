import SwiftUI

struct AuthenticationView: View {
  let store: AppStore

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Strava")
        .font(.title2.weight(.semibold))
      Text(statusText)
        .font(.callout)
        .foregroundStyle(.secondary)

      HStack {
        Button {
          Task { await store.connectStrava() }
        } label: {
          Label("Connect Strava", systemImage: "link")
        }
        .buttonStyle(.borderedProminent)
        .accessibilityLabel("Connect Strava")

        Button {
          Task { await store.disconnectStrava() }
        } label: {
          Label("Disconnect", systemImage: "xmark.circle")
        }
        .buttonStyle(.bordered)
        .disabled(store.stravaStatus?.status != "connected")
      }
    }
    .padding()
  }

  private var statusText: String {
    let status = store.stravaStatus?.status ?? "unknown"
    if store.configuration.usesFixtures {
      return "Fixture mode is active. Live Strava authorization opens through ASWebAuthenticationSession when live mode is selected."
    }
    return "Live mode is active. Current Strava status: \(status)."
  }
}
