import SwiftUI

struct ActivitiesView: View {
  private let activities = [
    RideActivity(title: "Barcelona Hills", date: "Jul 18, 2026", distance: "42.2 km", elevation: "680 m", status: "Processed"),
    RideActivity(title: "Coastal Tempo", date: "Jul 22, 2026", distance: "30.5 km", elevation: "315 m", status: "Eligible")
  ]

  var body: some View {
    NavigationStack {
      List {
        Section {
          Button {
          } label: {
            Label("Sync Activities", systemImage: "arrow.clockwise")
          }
          .accessibilityLabel("Sync activities")
        }

        Section("Recent Rides") {
          ForEach(activities) { activity in
            VStack(alignment: .leading, spacing: 8) {
              HStack {
                Text(activity.title).font(.headline)
                Spacer()
                Text(activity.status).font(.caption).foregroundStyle(.secondary)
              }
              Text("\(activity.date) · \(activity.distance) · \(activity.elevation) elevation")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
          }
        }
      }
      .navigationTitle("Rides")
    }
  }
}

struct RideActivity: Identifiable {
  let id = UUID()
  let title: String
  let date: String
  let distance: String
  let elevation: String
  let status: String
}

#Preview {
  ActivitiesView()
}

