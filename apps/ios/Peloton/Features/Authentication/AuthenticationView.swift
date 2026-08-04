import SwiftUI

struct AuthenticationView: View {
  let store: AppStore
  @State private var isConfirmingDataDeletion = false

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Strava")
        .font(.title2.weight(.semibold))
      Text(statusText)
        .font(.callout)
        .foregroundStyle(.secondary)

      if let consent = store.stravaConsentInfo {
        VStack(alignment: .leading, spacing: 10) {
          Text(consent.summary)
            .font(.callout)
          DisclosureGroup("Data and use") {
            VStack(alignment: .leading, spacing: 8) {
              consentList("Collected", consent.dataCollected)
              consentList("Used for", consent.dataUse)
              Text(consent.sharedOutputs)
              Text(consent.attribution.strava)
              Text(consent.attribution.garmin)
              Text("Support: \(consent.supportEmail)")
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(.top, 6)
          }
          .font(.subheadline.weight(.semibold))
          Text(consent.disconnect)
            .font(.footnote)
            .foregroundStyle(.secondary)
          Text(consent.deletion)
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }

      VStack(alignment: .leading, spacing: 10) {
        Button {
          Task { await store.connectStrava() }
        } label: {
          Label("Connect Strava", systemImage: "link")
        }
        .buttonStyle(.borderedProminent)
        .accessibilityLabel("Connect Strava")

        HStack {
          Button {
            Task { await store.disconnectStrava() }
          } label: {
            Label("Disconnect", systemImage: "xmark.circle")
          }
          .buttonStyle(.bordered)
          .disabled(!hasStravaConnection)

          Button(role: .destructive) {
            isConfirmingDataDeletion = true
          } label: {
            Label("Delete Data", systemImage: "trash")
          }
          .buttonStyle(.bordered)
          .disabled(!hasStravaConnection)
        }
      }
    }
    .padding()
    .confirmationDialog(
      "Delete stored Strava data?",
      isPresented: $isConfirmingDataDeletion,
      titleVisibility: .visible
    ) {
      Button("Delete Strava Data", role: .destructive) {
        Task { await store.deleteStravaData() }
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("This revokes Strava access and removes stored Strava imports, streams, webhook records, and dependent race rows.")
    }
  }

  private var statusText: String {
    let status = store.stravaStatus?.status ?? "unknown"
    if store.configuration.usesFixtures {
      return "Fixture mode is active. Live Strava authorization opens through ASWebAuthenticationSession when live mode is selected."
    }
    return "Live mode is active. Current Strava status: \(status)."
  }

  private var hasStravaConnection: Bool {
    guard let status = store.stravaStatus?.status else { return false }
    return status == "connected" || status == "expired" || status == "error" || status == "revoked"
  }

  private func consentList(_ title: String, _ items: [String]) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title).font(.footnote.weight(.semibold))
      ForEach(items, id: \.self) { item in
        Text("- \(item)")
      }
    }
  }
}
