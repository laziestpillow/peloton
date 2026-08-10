import Foundation
import PelotonCore
import SwiftUI

struct ResultSection: View {
  let title: String
  let entries: [ResultEntry]

  var body: some View {
    Section(title) {
      if entries.isEmpty {
        Text("No \(title.lowercased()) yet")
          .foregroundStyle(.secondary)
      } else {
        ForEach(entries) { entry in
          ResultRow(entry: entry)
        }
      }
    }
  }
}

struct LoadingResultsRow: View {
  var body: some View {
    HStack(spacing: 12) {
      ProgressView()
      Text("Loading results")
        .foregroundStyle(.secondary)
    }
    .padding(.vertical, 8)
    .accessibilityElement(children: .combine)
  }
}

struct ResultRow: View {
  let entry: ResultEntry

  var body: some View {
    HStack(spacing: 12) {
      Text("\(entry.rank)")
        .font(.headline.monospacedDigit())
        .frame(width: 30, height: 30)
        .background(entry.rank == 1 ? Color.yellow.opacity(0.25) : Color.gray.opacity(0.18), in: Circle())

      VStack(alignment: .leading, spacing: 4) {
        Text(entry.rider)
          .font(.headline)
        Text(entry.detail)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      Spacer()

      Text(entry.time)
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.trailing)
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }
}

struct ResultEntry: Identifiable {
  let id = UUID()
  let rank: Int
  let rider: String
  let detail: String
  let time: String
}

extension MarkerResult {
  var displayName: String {
    switch type {
    case "sprint":
      return "Sprint"
    case "climb":
      return "KOM"
    default:
      return type.capitalized
    }
  }
}

extension Int {
  var duration: String {
    let hours = self / 3600
    let minutes = (self % 3600) / 60
    let seconds = self % 60
    return hours > 0
      ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
      : String(format: "%d:%02d", minutes, seconds)
  }
}
