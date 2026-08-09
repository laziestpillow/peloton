import SwiftUI

struct AuthenticationView: View {
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Strava Connection")
                        .font(.title2.weight(.bold))
                    Text("Live authorization will start from the backend, then return to the app after Strava approves access.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
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
                        detail: "The login session should use ASWebAuthenticationSession."
                    )
                    AuthFlowRow(
                        icon: "checkmark.seal",
                        title: "Token exchange stays server-side",
                        detail: "The app receives only the connected account state."
                    )
                }
                .padding(16)
                .background(.background, in: RoundedRectangle(cornerRadius: 8))

                Button {
                } label: {
                    Label("Backend Auth Required", systemImage: "lock.shield")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(true)
                .accessibilityHint("Live Strava authorization is disabled until the backend flow is connected.")

                Spacer()
            }
            .padding(16)
            .navigationTitle("Account")
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

#Preview {
    AuthenticationView()
}
