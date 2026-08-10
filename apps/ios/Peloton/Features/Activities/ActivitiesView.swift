import Foundation
import PelotonCore
import SwiftUI

struct ActivitiesView: View {
  let store: AppStore

  private var processedCount: Int {
    store.activities.filter { $0.processedStageId != nil }.count
  }

  private var eligibleCount: Int {
    store.activities.filter { $0.processedStageId == nil }.count
  }

  var body: some View {
    NavigationStack {
      List {
        Section {
          AuthenticationView(store: store)
            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
        }

        Section {
          RaceCenterHeader(
            processedCount: processedCount,
            eligibleCount: eligibleCount,
            totalCount: store.activities.count,
            selectedStage: selectedStage
          )
          .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
          .listRowBackground(Color.clear)
        }

        Section("Import Control") {
          Button {
            Task { await store.syncActivities() }
          } label: {
            Label(store.isSyncing ? "Syncing Activities" : "Sync Activities", systemImage: syncIcon)
              .font(.headline)
          }
          .disabled(store.isSyncing)
          .accessibilityLabel(store.isSyncing ? "Syncing activities" : "Sync activities")
        }

        Section("Stages") {
          if store.isLoading && store.stages.isEmpty {
            LoadingRow(title: "Loading stages")
          } else if store.stages.isEmpty {
            ContentUnavailableView("No stages", systemImage: "flag.checkered")
          } else {
            ForEach(store.stages) { stage in
              StageSelectionRow(stage: stage, isSelected: stage.id == store.selectedStageId) {
                Task { await store.selectStage(stage) }
              }
            }
          }
        }

        Section("Recent Rides") {
          if store.isLoading && store.activities.isEmpty {
            LoadingRow(title: "Loading rides")
          } else if store.activities.isEmpty {
            ContentUnavailableView(
              "No rides yet",
              systemImage: "bicycle",
              description: Text("Synced rides will appear here when activity data is available.")
            )
          } else {
            ForEach(store.activities) { activity in
              ActivityRaceRow(activity: activity, attribution: attribution(for: activity))
            }
          }
        }
      }
      .listStyle(.insetGrouped)
      .navigationTitle("Rides")
      .refreshable {
        await store.loadInitialData()
      }
    }
  }

  private var selectedStage: Stage? {
    store.stages.first { $0.id == store.selectedStageId } ?? store.stages.first
  }

  private var syncIcon: String {
    store.isSyncing ? "arrow.triangle.2.circlepath" : "arrow.clockwise"
  }

  private func attribution(for activity: ImportedActivity) -> String? {
    guard activity.provider == "strava", let attribution = store.stravaConsentInfo?.attribution else {
      return nil
    }
    return "\(attribution.strava) \(attribution.garmin)"
  }
}

private struct RaceCenterHeader: View {
  let processedCount: Int
  let eligibleCount: Int
  let totalCount: Int
  let selectedStage: Stage?

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 6) {
          Text(selectedStage?.name ?? "Race Center")
            .font(.title2.weight(.bold))
          Text("Imported rides ready for stage building")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Spacer()

        Label(selectedStage?.status.capitalized ?? "Fixture", systemImage: "bolt.fill")
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(.yellow.opacity(0.18), in: Capsule())
          .foregroundStyle(.orange)
      }

      RouteMapPreview(stage: selectedStage)
        .frame(height: 130)
        .accessibilityLabel("Route map preview")

      HStack(spacing: 12) {
        SummaryMetric(value: "\(processedCount)", label: "Processed", color: .green)
        SummaryMetric(value: "\(eligibleCount)", label: "Eligible", color: .blue)
        SummaryMetric(value: "\(totalCount)", label: "Activities", color: .purple)
      }
    }
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 8))
  }
}

private struct RouteMapPreview: View {
  let stage: Stage?

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [Color.green.opacity(0.18), Color.blue.opacity(0.12)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      GridLines()
        .stroke(.white.opacity(0.45), lineWidth: 1)

      RouteLine()
        .stroke(.green, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
        .shadow(color: .green.opacity(0.4), radius: 4)

      HStack {
        MapPin(label: "Start", color: .green)
        Spacer()
        MapPin(label: "Finish", color: .red)
      }
      .padding(.horizontal, 18)
      .padding(.top, 46)
    }
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(alignment: .topLeading) {
      Label(routeLabel, systemImage: "map")
        .font(.caption.weight(.semibold))
        .padding(8)
        .background(.thinMaterial, in: Capsule())
        .padding(10)
    }
  }

  private var routeLabel: String {
    guard let distance = stage?.route.distanceMeters else {
      return "Route window"
    }
    return "\(distance.distanceText) route window"
  }
}

private struct StageSelectionRow: View {
  let stage: Stage
  let isSelected: Bool
  let select: () -> Void

  var body: some View {
    Button(action: select) {
      HStack(spacing: 12) {
        Image(systemName: "flag.checkered")
          .font(.headline)
          .frame(width: 32, height: 32)
          .background(.green.opacity(0.14), in: Circle())
          .foregroundStyle(.green)

        VStack(alignment: .leading, spacing: 4) {
          Text(stage.name)
            .font(.headline)
          Text("\(stage.route.distanceMeters.distanceText) - \(stage.status.capitalized)")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Spacer()

        if isSelected {
          Image(systemName: "checkmark.circle.fill")
            .foregroundStyle(.green)
        }
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}

private struct ActivityRaceRow: View {
  let activity: ImportedActivity
  let attribution: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          Text(activityTitle)
            .font(.headline)
          Text(activity.startedAt.formatted(date: .abbreviated, time: .shortened))
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        Spacer()

        Text(activity.importStatus.capitalized)
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(statusColor.opacity(0.15), in: Capsule())
          .foregroundStyle(statusColor)
      }

      HStack(spacing: 10) {
        RideMetric(icon: "location", value: activity.distanceMeters.distanceText, label: "Distance")
        RideMetric(icon: "clock", value: activity.movingTimeSeconds.compactDuration, label: "Time")
        RideMetric(icon: "arrow.up", value: "\(Int(activity.elevationGainMeters)) m", label: "Gain")
      }

      if let processedStageId = activity.processedStageId {
        Label("Processed as \(processedStageId)", systemImage: "flag.checkered")
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
      } else {
        Label("Ready to build into a stage", systemImage: "plus.circle")
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
      }

      if let attribution {
        Text(attribution)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 6)
    .accessibilityElement(children: .combine)
  }

  private var activityTitle: String {
    switch activity.importStatus {
    case "processed":
      return "Processed Ride"
    case "eligible":
      return "Eligible Ride"
    default:
      return activity.providerActivityId
    }
  }

  private var statusColor: Color {
    switch activity.importStatus {
    case "processed":
      return .green
    case "eligible":
      return .blue
    default:
      return .secondary
    }
  }
}

private struct RideMetric: View {
  let icon: String
  let value: String
  let label: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Label(value, systemImage: icon)
        .font(.caption.weight(.semibold))
        .lineLimit(1)
      Text(label)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct SummaryMetric: View {
  let value: String
  let label: String
  let color: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(value)
        .font(.headline.monospacedDigit())
        .foregroundStyle(color)
      Text(label)
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
  }
}

private struct LoadingRow: View {
  let title: String

  var body: some View {
    HStack(spacing: 12) {
      ProgressView()
      Text(title)
        .foregroundStyle(.secondary)
    }
    .padding(.vertical, 8)
    .accessibilityElement(children: .combine)
  }
}

private struct GridLines: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    let columns = 4
    let rows = 3

    for column in 1..<columns {
      let x = rect.width * CGFloat(column) / CGFloat(columns)
      path.move(to: CGPoint(x: x, y: rect.minY))
      path.addLine(to: CGPoint(x: x, y: rect.maxY))
    }

    for row in 1..<rows {
      let y = rect.height * CGFloat(row) / CGFloat(rows)
      path.move(to: CGPoint(x: rect.minX, y: y))
      path.addLine(to: CGPoint(x: rect.maxX, y: y))
    }

    return path
  }
}

private struct RouteLine: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.width * 0.12, y: rect.height * 0.70))
    path.addCurve(
      to: CGPoint(x: rect.width * 0.36, y: rect.height * 0.38),
      control1: CGPoint(x: rect.width * 0.18, y: rect.height * 0.44),
      control2: CGPoint(x: rect.width * 0.30, y: rect.height * 0.66)
    )
    path.addCurve(
      to: CGPoint(x: rect.width * 0.62, y: rect.height * 0.58),
      control1: CGPoint(x: rect.width * 0.44, y: rect.height * 0.18),
      control2: CGPoint(x: rect.width * 0.56, y: rect.height * 0.28)
    )
    path.addCurve(
      to: CGPoint(x: rect.width * 0.88, y: rect.height * 0.30),
      control1: CGPoint(x: rect.width * 0.70, y: rect.height * 0.86),
      control2: CGPoint(x: rect.width * 0.80, y: rect.height * 0.44)
    )
    return path
  }
}

private struct MapPin: View {
  let label: String
  let color: Color

  var body: some View {
    VStack(spacing: 4) {
      Circle()
        .fill(color)
        .frame(width: 12, height: 12)
        .overlay(Circle().stroke(.white, lineWidth: 2))
      Text(label)
        .font(.caption2.weight(.semibold))
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(.thinMaterial, in: Capsule())
    }
  }
}

private extension Double {
  var distanceText: String {
    String(format: "%.1f km", self / 1000)
  }
}

private extension Int {
  var compactDuration: String {
    let hours = self / 3600
    let minutes = (self % 3600) / 60
    if hours > 0 {
      return "\(hours)h \(minutes)m"
    }
    return "\(minutes)m"
  }
}

#Preview {
  ActivitiesView(store: AppStore.makeDefault())
}
