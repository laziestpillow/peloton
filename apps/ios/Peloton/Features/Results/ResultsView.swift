import SwiftUI

struct ResultsView: View {
  var body: some View {
    NavigationStack {
      List {
        Section("Stage Classification") {
          ResultRow(rank: 1, rider: "Marta", detail: "33 pts · 1:38:10")
          ResultRow(rank: 2, rider: "Leo", detail: "30 pts · 1:38:44")
        }
        Section("Marker Winners") {
          ResultRow(rank: 1, rider: "Marta", detail: "Sprint · 20 pts")
          ResultRow(rank: 1, rider: "Leo", detail: "KOM · 10 pts")
        }
        Section("Season") {
          ResultRow(rank: 1, rider: "Marta", detail: "84 pts · Sprinter · 76% confidence")
          ResultRow(rank: 2, rider: "Leo", detail: "79 pts · Climber · 72% confidence")
        }
      }
      .navigationTitle("Results")
    }
  }
}

struct ResultRow: View {
  let rank: Int
  let rider: String
  let detail: String

  var body: some View {
    HStack(spacing: 12) {
      Text("\(rank)")
        .font(.headline.monospacedDigit())
        .frame(width: 28, height: 28)
        .background(.quaternary, in: Circle())
      VStack(alignment: .leading) {
        Text(rider).font(.headline)
        Text(detail).font(.subheadline).foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

#Preview {
  ResultsView()
}

