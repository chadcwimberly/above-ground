import AppIntents
import Capacitor
import UIKit

/// Siri and Shortcuts: "I'm anxious in Above Ground", etc. Each opens the app straight into an exercise
/// through the same deep link the widgets use (aboveground://start?feeling=...).
@available(iOS 16.0, *)
enum Feeling: String, AppEnum {
    case anxiety, depression, grounding

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Feeling"
    static var caseDisplayRepresentations: [Feeling: DisplayRepresentation] = [
        .anxiety: "Anxious",
        .depression: "Depressed",
        .grounding: "Need grounding"
    ]
}

@available(iOS 16.0, *)
struct StartExerciseIntent: AppIntent {
    static var title: LocalizedStringResource = "Start an exercise"
    static var description = IntentDescription("Opens Above Ground to an exercise for how you're feeling.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Feeling")
    var feeling: Feeling

    init() {}
    init(feeling: Feeling) { self.feeling = feeling }

    @MainActor
    func perform() async throws -> some IntentResult {
        if let url = URL(string: "aboveground://start?feeling=\(feeling.rawValue)") {
            // Hands the link to Capacitor, which delivers it to the app (also on a cold start, via getLaunchUrl).
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        return .result()
    }
}

@available(iOS 16.0, *)
struct AboveGroundShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StartExerciseIntent(feeling: .anxiety),
                    phrases: ["I'm anxious in \(.applicationName)", "Calm me down with \(.applicationName)"],
                    shortTitle: "I'm feeling anxious", systemImageName: "wind")
        AppShortcut(intent: StartExerciseIntent(feeling: .depression),
                    phrases: ["I'm feeling down in \(.applicationName)", "Lift me up with \(.applicationName)"],
                    shortTitle: "I'm feeling depressed", systemImageName: "sun.max")
        AppShortcut(intent: StartExerciseIntent(feeling: .grounding),
                    phrases: ["Ground me with \(.applicationName)", "I need grounding in \(.applicationName)"],
                    shortTitle: "I need some grounding", systemImageName: "leaf")
    }
}
