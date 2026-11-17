import SwiftUI
import WidgetKit

// Home-screen and lock-screen widgets. They show no personal data; each tap opens the app through
// a deep link (aboveground://start?feeling=...), the same one Siri Shortcuts use.

private let bg = Color(red: 0xd8 / 255, green: 0xc6 / 255, blue: 0xb2 / 255)       // Hearth --bg
private let surface = Color(red: 0xe5 / 255, green: 0xd7 / 255, blue: 0xc6 / 255)  // --surface
private let ink = Color(red: 0x3a / 255, green: 0x2b / 255, blue: 0x21 / 255)      // --ink
private let accent = Color(red: 0x6f / 255, green: 0x4a / 255, blue: 0x33 / 255)   // --accent

private func link(_ feeling: String? = nil) -> URL {
    URL(string: feeling.map { "aboveground://start?feeling=\($0)" } ?? "aboveground://start")!
}

struct Entry: TimelineEntry { let date: Date }

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: Date())], policy: .never))
    }
}

private extension View {
    /// iOS 17 widgets declare their background; earlier versions just draw it.
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            padding().background(color)
        }
    }
}

struct FeelingsView: View {
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "leaf")
            }
            .widgetURL(link("grounding"))
            .accessibilityLabel("Ground me")
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Above Ground").font(.headline)
                Text("Take a grounding moment")
            }
            .widgetURL(link("grounding"))
        case .systemSmall:
            VStack(alignment: .leading, spacing: 6) {
                Text("Above Ground").font(.headline).foregroundColor(ink)
                Spacer()
                Text("Take a moment").font(.title3).foregroundColor(accent)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetBackground(bg)
            .widgetURL(link())
        default:
            VStack(alignment: .leading, spacing: 8) {
                Text("Above Ground").font(.headline).foregroundColor(ink)
                row("I'm feeling anxious", "anxiety")
                row("I'm feeling depressed", "depression")
                row("I need some grounding", "grounding")
            }
            .widgetBackground(bg)
        }
    }

    private func row(_ title: String, _ feeling: String) -> some View {
        Link(destination: link(feeling)) {
            Text(title)
                .font(.subheadline)
                .foregroundColor(ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6).padding(.horizontal, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(surface))
        }
    }
}

struct FeelingsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FeelingsWidget", provider: Provider()) { _ in FeelingsView() }
            .configurationDisplayName("Above Ground")
            .description("Start an exercise for how you're feeling.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct AboveGroundWidgetBundle: WidgetBundle {
    var body: some Widget { FeelingsWidget() }
}
