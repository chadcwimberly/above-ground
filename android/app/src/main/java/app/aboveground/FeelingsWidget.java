package app.aboveground;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Home-screen widget: each choice opens the app at aboveground://start?feeling=... (see src/platform.js). */
public class FeelingsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.feelings_widget);
            views.setOnClickPendingIntent(R.id.feel_anxiety, open(context, "anxiety", 1));
            views.setOnClickPendingIntent(R.id.feel_depression, open(context, "depression", 2));
            views.setOnClickPendingIntent(R.id.feel_grounding, open(context, "grounding", 3));
            manager.updateAppWidget(id, views);
        }
    }

    private static PendingIntent open(Context context, String feeling, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("aboveground://start?feeling=" + feeling), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
