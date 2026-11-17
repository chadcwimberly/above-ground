package app.aboveground;

import android.Manifest;
import android.content.Context;
import android.health.connect.HealthConnectManager;
import android.health.connect.InsertRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.datatypes.Metadata;
import android.health.connect.datatypes.MindfulnessSessionRecord;
import android.os.Build;
import android.os.OutcomeReceiver;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.time.Instant;
import java.util.Collections;

/**
 * Saves completed sessions to Health Connect as mindfulness sessions. Write-only: Above Ground never reads
 * health data. Uses the Health Connect built into Android 16+ (API 36), where mindfulness sessions exist;
 * on older Android versions isAvailable() reports false and the setting stays hidden.
 * JS name "Health" (see src/platform.js), matching the iOS plugin that uses Apple Health.
 */
@CapacitorPlugin(
    name = "Health",
    permissions = { @Permission(alias = "mindfulness", strings = { "android.permission.health.WRITE_MINDFULNESS" }) }
)
public class HealthPlugin extends Plugin {
    private static final int MIN_SDK = 36;

    private boolean supported() {
        return Build.VERSION.SDK_INT >= MIN_SDK && getContext().getSystemService(HealthConnectManager.class) != null;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", supported());
        call.resolve(r);
    }

    @PluginMethod
    public void requestAuthorization(PluginCall call) {
        if (!supported()) { granted(call, false); return; }
        if (getPermissionState("mindfulness") == PermissionState.GRANTED) { granted(call, true); return; }
        requestPermissionForAlias("mindfulness", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        granted(call, getPermissionState("mindfulness") == PermissionState.GRANTED);
    }

    private static void granted(PluginCall call, boolean ok) {
        JSObject r = new JSObject();
        r.put("granted", ok);
        call.resolve(r);
    }

    /** start and end are milliseconds since 1970 (JavaScript Date.now()). */
    @PluginMethod
    public void logMindfulSession(PluginCall call) {
        Double start = call.getDouble("start"), end = call.getDouble("end");
        if (start == null || end == null || end <= start) { call.reject("start and end are required"); return; }
        if (!supported()) { call.reject("Health Connect mindfulness sessions need Android 16 or later"); return; }
        if (getPermissionState("mindfulness") != PermissionState.GRANTED) { call.reject("not authorized"); return; }
        if (Build.VERSION.SDK_INT < MIN_SDK) return;
        Context ctx = getContext();
        HealthConnectManager hc = ctx.getSystemService(HealthConnectManager.class);
        MindfulnessSessionRecord record = new MindfulnessSessionRecord.Builder(
            new Metadata.Builder().build(),
            Instant.ofEpochMilli(start.longValue()),
            Instant.ofEpochMilli(end.longValue()),
            MindfulnessSessionRecord.MINDFULNESS_SESSION_TYPE_UNKNOWN
        ).build();
        hc.insertRecords(Collections.singletonList(record), ctx.getMainExecutor(),
            new OutcomeReceiver<InsertRecordsResponse, HealthConnectException>() {
                @Override public void onResult(InsertRecordsResponse response) { call.resolve(); }
                @Override public void onError(HealthConnectException e) { call.reject(e.getMessage()); }
            });
    }
}
