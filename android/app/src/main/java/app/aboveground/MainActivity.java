package app.aboveground;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that live in this app (not in npm packages) are registered before the bridge starts.
        registerPlugin(HealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
