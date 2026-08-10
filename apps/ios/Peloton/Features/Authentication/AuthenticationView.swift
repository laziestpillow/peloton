import SwiftUI

struct AuthenticationView: View {
  let store: AppStore
  @State private var isConfirmingDataDeletion = false

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 6) {
          Text("Strava Connection")
            .font(.title2.weight(.bold))
          Text(statusText)
            .font(.callout)
            .foregroundStyle(.secondary)
        }

        Spacer()

        Text(statusBadge)
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(statusColor.opacity(0.14), in: Capsule())
          .foregroundStyle(statusColor)
      }

      VStack(alignment: .leading, spacing: 12) {
        AuthFlowRow(
          icon: "server.rack",
          title: "Backend starts OAuth",
          detail: "The app requests a server-owned authorization URL."
        )
        AuthFlowRow(
          icon: "safari",
          title: "System browser opens Strava",
          detail: "The login session uses ASWebAuthenticationSession."
        )
        AuthFlowRow(
          icon: "checkmark.seal",
          title: "Token exchange stays server-side",
          detail: "The app receives only connected account state."
        )
      }
      .padding(16)
      .background(.background, in: RoundedRectangle(cornerRadius: 8))

      if let consent = store.stravaConsentInfo {
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

        VStack(alignment: .leading, spacing: 4) {
          Text(consent.disconnect)
          Text(consent.deletion)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }

      VStack(alignment: .leading, spacing: 10) {
        Button {
          Task { await store.connectStrava() }
        } label: {
          Label(connectButtonTitle, systemImage: "link")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .accessibilityLabel(connectButtonTitle)

        HStack(spacing: 10) {
          Button {
            Task { await store.disconnectStrava() }
          } label: {
            Label("Disconnect", systemImage: "xmark.circle")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .disabled(!hasStravaConnection)

          Button(role: .destructive) {
            isConfirmingDataDeletion = true
          } label: {
            Label("Delete Data", systemImage: "trash")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .disabled(!hasStravaConnection)
        }
      }
    }
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
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
    if store.configuration.usesFixtures {
      return "Fixture mode is active. Live authorization starts from the backend when live mode is selected."
    }
    return "Live authorization starts from the backend and returns connected account state to the app."
  }

  private var statusBadge: String {
    store.configuration.usesFixtures ? "Fixture" : (store.stravaStatus?.status.capitalized ?? "Unknown")
  }

  private var statusColor: Color {
    switch store.stravaStatus?.status {
    case "connected":
      return .green
    case "expired", "error":
      return .orange
    case "revoked":
      return .red
    default:
      return store.configuration.usesFixtures ? .blue : .secondary
    }
  }

  private var connectButtonTitle: String {
    hasStravaConnection ? "Reconnect Strava" : "Connect Strava"
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

private struct AuthFlowRow: View {
  let icon: String
  let title: String
  let detail: String

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: icon)
        .font(.headline)
        .frame(width: 34, height: 34)
        .background(.blue.opacity(0.12), in: Circle())
        .foregroundStyle(.blue)

      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(.subheadline.weight(.semibold))
        Text(detail)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}
