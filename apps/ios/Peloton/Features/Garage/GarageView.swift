import SwiftUI

struct GarageView: View {
    @State private var riderName = "Marta"
    @State private var jerseyColor = Color.blue
    @State private var accentColor = Color.yellow
    @State private var helmetColor = Color.white
    @State private var bikeColor = Color.black
    @State private var pattern = KitPattern.stripes
    @State private var savedRiderName = "Marta"
    @State private var savedJerseyColor = Color.blue
    @State private var savedAccentColor = Color.yellow
    @State private var savedHelmetColor = Color.white
    @State private var savedBikeColor = Color.black
    @State private var savedPattern = KitPattern.stripes

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    RiderGarageHeader(
                        riderName: riderName,
                        jerseyColor: jerseyColor,
                        accentColor: accentColor,
                        helmetColor: helmetColor,
                        bikeColor: bikeColor,
                        pattern: pattern
                    )
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                    .listRowBackground(Color.clear)
                }

                Section("Identity") {
                    TextField("Display name", text: $riderName)
                        .textInputAutocapitalization(.words)
                        .accessibilityLabel("Display name")

                    HStack {
                        Label("Race name", systemImage: "person.text.rectangle")
                        Spacer()
                        Text(trimmedRiderName.isEmpty ? "Required" : trimmedRiderName)
                            .foregroundStyle(nameValidation == nil ? .secondary : .red)
                    }
                    .font(.subheadline)

                    if let nameValidation {
                        Label(nameValidation, systemImage: "exclamationmark.circle")
                            .font(.caption)
                            .foregroundStyle(.red)
                    } else {
                        Label("Looks ready for race cards and recaps", systemImage: "checkmark.circle")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }

                Section("Kit Colors") {
                    GarageColorPicker(title: "Jersey", icon: "tshirt", color: $jerseyColor)
                    GarageColorPicker(title: "Accent", icon: "paintpalette", color: $accentColor)
                    GarageColorPicker(title: "Helmet", icon: "circle.tophalf.filled", color: $helmetColor)
                    GarageColorPicker(title: "Bike", icon: "bicycle", color: $bikeColor)
                }

                Section("Kit Pattern") {
                    Picker("Pattern", selection: $pattern) {
                        ForEach(KitPattern.allCases, id: \.self) { pattern in
                            Text(pattern.title).tag(pattern)
                        }
                    }
                    .pickerStyle(.segmented)

                    PatternSummary(pattern: pattern)
                }

                Section("Actions") {
                    Button {
                        saveAppearance()
                    } label: {
                        Label("Save Race Identity", systemImage: "checkmark.circle.fill")
                    }
                    .disabled(!canSave)

                    Button(role: .destructive) {
                        resetAppearance()
                    } label: {
                        Label("Reset Appearance", systemImage: "arrow.counterclockwise")
                    }
                    .disabled(!hasChanges)
                }
            }
            .navigationTitle("Garage")
        }
    }

    private var trimmedRiderName: String {
        riderName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var nameValidation: String? {
        if trimmedRiderName.isEmpty {
            return "Enter a race display name."
        }

        if trimmedRiderName.count < 2 {
            return "Use at least 2 characters."
        }

        if trimmedRiderName.count > 24 {
            return "Use 24 characters or fewer."
        }

        return nil
    }

    private var canSave: Bool {
        nameValidation == nil && hasChanges
    }

    private var hasChanges: Bool {
        trimmedRiderName != savedRiderName || jerseyColor != savedJerseyColor || accentColor != savedAccentColor || helmetColor != savedHelmetColor || bikeColor != savedBikeColor || pattern != savedPattern
    }

    private func saveAppearance() {
        guard nameValidation == nil else { return }

        riderName = trimmedRiderName
        savedRiderName = trimmedRiderName
        savedJerseyColor = jerseyColor
        savedAccentColor = accentColor
        savedHelmetColor = helmetColor
        savedBikeColor = bikeColor
        savedPattern = pattern
    }

    private func resetAppearance() {
        riderName = savedRiderName
        jerseyColor = savedJerseyColor
        accentColor = savedAccentColor
        helmetColor = savedHelmetColor
        bikeColor = savedBikeColor
        pattern = savedPattern
    }
}

private struct RiderGarageHeader: View {
    let riderName: String
    let jerseyColor: Color
    let accentColor: Color
    let helmetColor: Color
    let bikeColor: Color
    let pattern: KitPattern

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Race Garage")
                        .font(.title2.weight(.bold))
                    Text("Tune the rider identity shown in recaps and results")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text("Fixture")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.blue.opacity(0.14), in: Capsule())
                    .foregroundStyle(.blue)
            }

            HStack(spacing: 18) {
                AvatarPreview(
                    jerseyColor: jerseyColor,
                    accentColor: accentColor,
                    helmetColor: helmetColor,
                    bikeColor: bikeColor,
                    pattern: pattern
                )
                .scaleEffect(0.86)
                .frame(width: 132, height: 146)

                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(riderName.isEmpty ? "Unnamed rider" : riderName)
                            .font(.title3.weight(.bold))
                            .lineLimit(1)
                        Text("Current race identity")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: 8) {
                        GarageSwatch(color: jerseyColor, label: "Jersey")
                        GarageSwatch(color: accentColor, label: "Accent")
                        GarageSwatch(color: bikeColor, label: "Bike")
                    }

                    Label(pattern.title, systemImage: "square.grid.3x3.fill")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 6)
                        .background(accentColor.opacity(0.16), in: Capsule())
                        .foregroundStyle(accentColor)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }
}

private struct GarageColorPicker: View {
    let title: String
    let icon: String
    @Binding var color: Color

    var body: some View {
        ColorPicker(selection: $color, supportsOpacity: false) {
            Label(title, systemImage: icon)
        }
    }
}

private struct GarageSwatch: View {
    let color: Color
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 22, height: 22)
                .overlay(Circle().stroke(.primary.opacity(0.14), lineWidth: 1))
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct PatternSummary: View {
    let pattern: KitPattern

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: pattern.systemImage)
                .frame(width: 30, height: 30)
                .background(.quaternary, in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(pattern.title)
                    .font(.subheadline.weight(.semibold))
                Text(pattern.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}



#Preview {
    GarageView()
}
