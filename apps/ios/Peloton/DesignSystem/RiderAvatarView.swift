import SwiftUI

enum KitPattern: CaseIterable {
    case solid
    case stripes
    case polkaDots

    var title: String {
        switch self {
        case .solid:
            return "Solid"
        case .stripes:
            return "Stripes"
        case .polkaDots:
            return "Dots"
        }
    }

    var description: String {
        switch self {
        case .solid:
            return "Clean kit for a general classification look."
        case .stripes:
            return "High-contrast road race styling."
        case .polkaDots:
            return "Climber-inspired mountain pattern."
        }
    }

    var systemImage: String {
        switch self {
        case .solid:
            return "square.fill"
        case .stripes:
            return "line.3.horizontal"
        case .polkaDots:
            return "circle.grid.2x2.fill"
        }
    }
}

struct RiderAvatarView: View {
    let jerseyColor: Color
    let accentColor: Color
    let helmetColor: Color
    let bikeColor: Color
    let pattern: KitPattern

    var body: some View {
        ZStack {
            Circle().fill(helmetColor).frame(width: 36, height: 36).offset(y: -42).shadow(radius: 1)
            RoundedRectangle(cornerRadius: 8).fill(jerseyColor).frame(width: 58, height: 70)
            patternOverlay
            Capsule().fill(bikeColor).frame(width: 112, height: 8).offset(y: 52)
            Circle().stroke(accentColor, lineWidth: 5).frame(width: 34, height: 34).offset(x: -42, y: 62)
            Circle().stroke(accentColor, lineWidth: 5).frame(width: 34, height: 34).offset(x: 42, y: 62)
        }
        .frame(width: 150, height: 170)
        .accessibilityLabel("Rider avatar")
    }

    @ViewBuilder
    private var patternOverlay: some View {
        switch pattern {
        case .solid:
            EmptyView()
        case .stripes:
            HStack(spacing: 7) {
                ForEach(0..<3) { _ in accentColor.frame(width: 6, height: 68) }
            }
        case .polkaDots:
            VStack(spacing: 9) {
                ForEach(0..<3) { _ in
                    HStack(spacing: 9) {
                        ForEach(0..<2) { _ in Circle().fill(accentColor).frame(width: 8, height: 8) }
                    }
                }
            }
        }
    }
}

struct AvatarPreview: View {
    let jerseyColor: Color
    let accentColor: Color
    let helmetColor: Color
    let bikeColor: Color
    let pattern: KitPattern

    var body: some View {
        RiderAvatarView(
            jerseyColor: jerseyColor,
            accentColor: accentColor,
            helmetColor: helmetColor,
            bikeColor: bikeColor,
            pattern: pattern
        )
        .accessibilityLabel("Live avatar preview")
    }
}

#Preview {
    RiderAvatarView(
        jerseyColor: Color.blue,
        accentColor: Color.yellow,
        helmetColor: Color.white,
        bikeColor: Color.black,
        pattern: KitPattern.stripes
    )
}
