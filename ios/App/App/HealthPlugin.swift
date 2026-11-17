import Capacitor
import HealthKit

/// Saves completed sessions to Apple Health as Mindful Minutes. Write-only: Above Ground never reads health data.
/// JS name "Health" (see src/platform.js). Android has a matching plugin using Health Connect.
@objc(HealthPlugin)
public class HealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthPlugin"
    public let jsName = "Health"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logMindfulSession", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()
    private let mindful = HKObjectType.categoryType(forIdentifier: .mindfulSession)!

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { return call.resolve(["granted": false]) }
        store.requestAuthorization(toShare: [mindful], read: nil) { _, _ in
            call.resolve(["granted": self.store.authorizationStatus(for: self.mindful) == .sharingAuthorized])
        }
    }

    /// start and end are milliseconds since 1970 (JavaScript Date.now()).
    @objc func logMindfulSession(_ call: CAPPluginCall) {
        guard let start = call.getDouble("start"), let end = call.getDouble("end"), end > start else {
            return call.reject("start and end are required")
        }
        guard store.authorizationStatus(for: mindful) == .sharingAuthorized else { return call.reject("not authorized") }
        let sample = HKCategorySample(type: mindful, value: HKCategoryValue.notApplicable.rawValue,
                                      start: Date(timeIntervalSince1970: start / 1000),
                                      end: Date(timeIntervalSince1970: end / 1000))
        store.save(sample) { ok, error in
            ok ? call.resolve() : call.reject(error?.localizedDescription ?? "Could not save")
        }
    }
}
