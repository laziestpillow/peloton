import SwiftUI

struct GarageView: View {
  @State private var riderName = "Marta"
  @State private var jerseyColor = Color.blue
  @State private var accentColor = Color.yellow
  @State private var helmetColor = Color.white
  @State private var bikeColor = Color.black
  @State private var pattern = KitPattern.stripes

  var body: some View {
    NavigationStack {
      Form {
        Section {
          HStack {
            Spacer()
            AvatarPreview(jerseyColor: jerseyColor, accentColor: accentColor, helmetColor: helmetColor, bikeColor: bikeColor, pattern: pattern)
            Spacer()
          }
          .listRowBackground(Color.clear)
        }

        Section("Identity") {
          TextField("Display name", text: $riderName)
            .textInputAutocapitalization(.words)
            .accessibilityLabel("Display name")
        }

        Section("Colors") {
          ColorPicker("Jersey", selection: $jerseyColor, supportsOpacity: false)
          ColorPicker("Accent", selection: $accentColor, supportsOpacity: false)
          ColorPicker("Helmet", selection: $helmetColor, supportsOpacity: false)
          ColorPicker("Bike", selection: $bikeColor, supportsOpacity: false)
        }

        Section("Kit Pattern") {
          Picker("Pattern", selection: $pattern) {
            ForEach(KitPattern.allCases, id: \.self) { pattern in
              Text(pattern.title).tag(pattern)
            }
          }
          .pickerStyle(.segmented)
        }
      }
      .navigationTitle("Garage")
    }
  }
}

enum KitPattern: CaseIterable {
  case solid
  case stripes
  case polkaDots

  var title: String {
    switch self {
    case .solid: "Solid"
    case .stripes: "Stripes"
    case .polkaDots: "Dots"
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
    ZStack {
      Circle().fill(helmetColor).frame(width: 36, height: 36).offset(y: -42).shadow(radius: 1)
      RoundedRectangle(cornerRadius: 8).fill(jerseyColor).frame(width: 58, height: 70)
      patternOverlay
      Capsule().fill(bikeColor).frame(width: 112, height: 8).offset(y: 52)
      Circle().stroke(accentColor, lineWidth: 5).frame(width: 34, height: 34).offset(x: -42, y: 62)
      Circle().stroke(accentColor, lineWidth: 5).frame(width: 34, height: 34).offset(x: 42, y: 62)
    }
    .frame(width: 150, height: 170)
    .accessibilityLabel("Live avatar preview")
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

#Preview {
  GarageView()
}

