package com.jportal.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Renders the JSON snapshot `WidgetBridgePlugin` stores into the home-screen widget's RemoteViews. */
public class ScheduleWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateAllWidgets(context, appWidgetManager, appWidgetIds);
    }

    public static void updateAllWidgets(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        if (appWidgetIds == null) return;
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(WidgetBridgePlugin.KEY_SNAPSHOT, null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_schedule);
        hideAll(views);

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        }

        if (json == null) {
            showEmpty(views, "Open JP WebPortal to load your schedule");
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        try {
            JSONObject data = new JSONObject(json);
            if (!data.optBoolean("hasSchedule", false)) {
                showEmpty(views, "Import your timetable in the app");
                appWidgetManager.updateAppWidget(appWidgetId, views);
                return;
            }

            boolean hasActive = data.optBoolean("hasActive", false);
            boolean allDone = data.optBoolean("allDone", false);

            if (hasActive) {
                JSONObject active = data.getJSONObject("active");
                views.setViewVisibility(R.id.widget_active_block, View.VISIBLE);
                views.setTextViewText(R.id.widget_section_label, data.optString("sectionLabel", ""));
                views.setTextViewText(R.id.widget_active_name, active.optString("name", ""));
                String room = active.optString("room", "");
                String time = active.optString("time", "");
                views.setTextViewText(R.id.widget_active_time, room.isEmpty() ? time : time + " · " + room);
            } else if (allDone) {
                views.setViewVisibility(R.id.widget_alldone, View.VISIBLE);
            }

            JSONArray upcoming = data.optJSONArray("upcoming");
            int[] rowIds = { R.id.widget_up_row1, R.id.widget_up_row2 };
            int[] nameIds = { R.id.widget_up_name1, R.id.widget_up_name2 };
            int[] timeIds = { R.id.widget_up_time1, R.id.widget_up_time2 };
            for (int i = 0; i < rowIds.length; i++) {
                if (upcoming != null && i < upcoming.length()) {
                    JSONObject u = upcoming.getJSONObject(i);
                    views.setViewVisibility(rowIds[i], View.VISIBLE);
                    views.setTextViewText(nameIds[i], u.optString("name", ""));
                    views.setTextViewText(timeIds[i], u.optString("time", ""));
                }
            }
        } catch (JSONException e) {
            showEmpty(views, "Open the app to refresh your schedule");
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static void hideAll(RemoteViews views) {
        views.setViewVisibility(R.id.widget_active_block, View.GONE);
        views.setViewVisibility(R.id.widget_alldone, View.GONE);
        views.setViewVisibility(R.id.widget_up_row1, View.GONE);
        views.setViewVisibility(R.id.widget_up_row2, View.GONE);
        views.setViewVisibility(R.id.widget_empty, View.GONE);
    }

    private static void showEmpty(RemoteViews views, String message) {
        views.setTextViewText(R.id.widget_empty, message);
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
    }
}
