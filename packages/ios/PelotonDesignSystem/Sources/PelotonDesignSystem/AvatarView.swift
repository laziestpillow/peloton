import SwiftUI
import PelotonCore

public struct RiderAvatarView: View {
  private let appearance: RiderAppearance

  public init(appearance: RiderAppearance) {
    self.appearance = appearance
  }

  public var body: some View {
    ZStack {
      Circle().fill(color(appearance.helmetColor)).frame(width: 32, height: 32).offset(y: -36)
      RoundedRectangle(cornerRadius: 8).fill(color(appearance.jerseyColor)).frame(width: 48, height: 58)
      patternOverlay
      Capsule().fill(color(appearance.bikeColor)).frame(width: 92, height: 8).offset(y: 42)
      Circle().stroke(color(appearance.accentColor), lineWidth: 4).frame(width: 28, height: 28).offset(x: -34, y: 52)
      Circle().stroke(color(appearance.accentColor), lineWidth: 4).frame(width: 28, height: 28).offset(x: 34, y: 52)
    }
    .frame(width: 120, height: 140)
    .accessibilityLabel("Rider avatar preview")
  }

  @ViewBuilder
  private var patternOverlay: some View {
    switch appearance.pattern {
    case .solid:
      EmptyView()
    case .stripes:
      HStack(spacing: 5) {
        ForEach(0..<3) { _ in color(appearance.accentColor).frame(width: 5, height: 56) }
      }
    case .polkaDots:
      VStack(spacing: 8) {
        ForEach(0..<3) { _ in
          HStack(spacing: 8) {
            ForEach(0..<2) { _ in Circle().fill(color(appearance.accentColor)).frame(width: 7, height: 7) }
          }
        }
      }
    }
  }

  private func color(_ hex: String) -> Color {
    var value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    if value.count == 3 {
      value = value.map { "\($0)\($0)" }.joined()
    }
    guard let integer = UInt64(value, radix: 16) else {
      return .gray
    }
    return Color(
      red: Double((integer >> 16) & 0xFF) / 255,
      green: Double((integer >> 8) & 0xFF) / 255,
      blue: Double(integer & 0xFF) / 255
    )
  }
}

