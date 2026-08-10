import SwiftUI

struct JerseyLeaderCard: View {
  let leader: JerseyLeaderResult

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top) {
        JerseyIcon(jersey: leader.jersey)
          .frame(width: 48, height: 54)
          .accessibilityHidden(true)

        Spacer()

        Text(leader.jersey.shortLabel)
          .font(.caption2.weight(.bold))
          .padding(.horizontal, 7)
          .padding(.vertical, 4)
          .background(leader.jersey.color.opacity(0.16), in: Capsule())
          .foregroundStyle(leader.jersey.textColor)
      }

      VStack(alignment: .leading, spacing: 3) {
        Text(leader.rider)
          .font(.headline)
          .lineLimit(1)
        Text(leader.subtitle)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }

      Text(leader.detail)
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(leader.jersey.textColor)
    }
    .padding(12)
    .background(leader.jersey.color.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8)
        .stroke(leader.jersey.color.opacity(0.22), lineWidth: 1)
    )
    .accessibilityElement(children: .combine)
  }
}

struct JerseyIcon: View {
  let jersey: LeaderJersey

  var body: some View {
    ZStack {
      JerseyShape()
        .fill(jersey.color)

      if jersey == .polkaDot {
        PolkaDotPattern()
          .fill(.red)
          .clipShape(JerseyShape())
      }

      JerseyShape()
        .stroke(.primary.opacity(0.14), lineWidth: 1)
    }
  }
}

struct JerseyShape: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.width * 0.28, y: rect.height * 0.08))
    path.addLine(to: CGPoint(x: rect.width * 0.12, y: rect.height * 0.20))
    path.addLine(to: CGPoint(x: rect.width * 0.02, y: rect.height * 0.42))
    path.addLine(to: CGPoint(x: rect.width * 0.20, y: rect.height * 0.50))
    path.addLine(to: CGPoint(x: rect.width * 0.24, y: rect.height * 0.94))
    path.addLine(to: CGPoint(x: rect.width * 0.76, y: rect.height * 0.94))
    path.addLine(to: CGPoint(x: rect.width * 0.80, y: rect.height * 0.50))
    path.addLine(to: CGPoint(x: rect.width * 0.98, y: rect.height * 0.42))
    path.addLine(to: CGPoint(x: rect.width * 0.88, y: rect.height * 0.20))
    path.addLine(to: CGPoint(x: rect.width * 0.72, y: rect.height * 0.08))
    path.addQuadCurve(
      to: CGPoint(x: rect.width * 0.28, y: rect.height * 0.08),
      control: CGPoint(x: rect.width * 0.50, y: rect.height * 0.22)
    )
    path.closeSubpath()
    return path
  }
}

struct PolkaDotPattern: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    let dotSize = min(rect.width, rect.height) * 0.13
    let points = [
      CGPoint(x: rect.width * 0.32, y: rect.height * 0.30),
      CGPoint(x: rect.width * 0.64, y: rect.height * 0.32),
      CGPoint(x: rect.width * 0.45, y: rect.height * 0.52),
      CGPoint(x: rect.width * 0.68, y: rect.height * 0.70),
      CGPoint(x: rect.width * 0.30, y: rect.height * 0.75)
    ]

    for point in points {
      path.addEllipse(in: CGRect(x: point.x - dotSize / 2, y: point.y - dotSize / 2, width: dotSize, height: dotSize))
    }

    return path
  }
}

struct JerseyLeaderResult: Identifiable {
  let id = UUID()
  let jersey: LeaderJersey
  let rider: String
  let detail: String
  let subtitle: String
}

enum LeaderJersey {
  case green
  case polkaDot
  case yellow

  var shortLabel: String {
    switch self {
    case .green:
      return "PTS"
    case .polkaDot:
      return "KOM"
    case .yellow:
      return "GC"
    }
  }

  var color: Color {
    switch self {
    case .green:
      return .green
    case .polkaDot:
      return .white
    case .yellow:
      return .yellow
    }
  }

  var textColor: Color {
    switch self {
    case .green:
      return .green
    case .polkaDot:
      return .red
    case .yellow:
      return .orange
    }
  }
}
