import SwiftUI
import Foundation
import PelotonCore

struct ActivitiesView: View {
  let store: AppStore

  var body: some View {
    NavigationStack {
      List {
        Section {
          AuthenticationView(store: store)
        }

        Section {
          Button {
            Task { await store.syncActivities() }
          } label: {
            Label(store.isSyncing ? "Syncing" : "Sync Activities", systemImage: "arrow.clockwise")
          }
          .accessibilityLabel("Sync activities")
          .disabled(store.isSyncing)
        }

        Section("Stages") {
          if store.stages.isEmpty {
            ContentUnavailableView("No stages", systemImage: "flag.checkered")
          } else {
            ForEach(store.stages) { stage in
              Button {
                Task { await store.selectStage(stage) }
              } label: {
                HStack {
                  VStack(alignment: .leading, spacing: 4) {
                    Text(stage.name).font(.headline)
                    Text("\(stage.route.distanceMeters.kilometers) km - \(stage.status.capitalized)")
                      .font(.subheadline)
                      .foregroundStyle(.secondary)
                  }
                  Spacer()
                  if stage.id == store.selectedStageId {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                  }
                }
              }
            }
          }
        }

        Section("Recent Rides") {
          if store.isLoading {
            ProgressView("Loading rides")
          } else if store.activities.isEmpty {
            ContentUnavailableView("No rides", systemImage: "bicycle")
          } else {
            ForEach(store.activities) { activity in
              VStack(alignment: .leading, spacing: 8) {
                HStack {
                  Text(activity.providerActivityId).font(.headline)
                  Spacer()
                  Text(activity.importStatus.capitalized).font(.caption).foregroundStyle(.secondary)
                }
                Text("\(activity.startedAt.formatted(date: .abbreviated, time: .shortened)) - \(activity.distanceMeters.kilometers) km - \(Int(activity.elevationGainMeters)) m elevation")
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
              .padding(.vertical, 4)
              .accessibilityElement(children: .combine)
            }
          }
        }
      }
      .navigationTitle("Rides")
      .refreshable {
        await store.loadInitialData()
      }
    }
  }
}

private extension Double {
  var kilometers: String {
    String(format: "%.1f", self / 1000)
  }
}

#Preview {
  ActivitiesView(store: AppStore.makeDefault())
}
