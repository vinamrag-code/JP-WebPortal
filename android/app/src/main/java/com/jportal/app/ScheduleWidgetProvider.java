package com.jportal.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

import androidx.core.widget.RemoteViewsCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Home-screen widget: every class for the day (today, or the next day with classes once today's over),
 * each with the subject's attendance percentage - ported from jiit-widget's own ScheduleWidgetProvider,
 * which used the same `RemoteViewsCompat` dynamic-list approach to show the whole day rather than a fixed
 * "current + 2 upcoming" cap.
 *
 * Renders only from the JSON snapshot `WidgetBridgePlugin` stores (itself built by the web app from local
 * data - the saved timetable plus whatever attendance the Attendance screen has already cached this
 * session); it never touches the network itself.
 */
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

        PendingIntent openApp = PendingIntent.getActivity(
            context, 0,
            new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_header, openApp);
        views.setOnClickPendingIntent(R.id.widget_empty, openApp);
        // List rows can't hold their own PendingIntents; they fill in this template instead, and the
        // template must be mutable for the fill-in to apply.
        views.setPendingIntentTemplate(
            R.id.widget_list,
            PendingIntent.getActivity(
                context, 1,
                new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
            )
        );
        views.setEmptyView(R.id.widget_list, R.id.widget_empty);

        JSONArray rows = null;
        JSONObject active = null;
        String activeLabel = "";
        String dayLabel = "Timetable";
        String emptyMessage = "Open JP WebPortal to load your schedule";
        boolean hasSchedule = false;

        if (json != null) {
            try {
                JSONObject data = new JSONObject(json);
                hasSchedule = data.optBoolean("hasSchedule", false);
                if (hasSchedule) {
                    dayLabel = data.optString("dayLabel", "Today");
                    rows = data.optJSONArray("rows");
                    active = data.optJSONObject("active");
                    activeLabel = data.optString("activeLabel", "");
                    emptyMessage = "No classes";
                } else {
                    emptyMessage = "Import your timetable in the app";
                }
            } catch (JSONException e) {
                emptyMessage = "Open the app to refresh your schedule";
            }
        }

        views.setTextViewText(R.id.widget_title, dayLabel);
        views.setTextViewText(R.id.widget_status, "");
        views.setTextViewText(R.id.widget_empty, emptyMessage);

        // Featured card: today's current class, or the next one once there's no class running. Shown only
        // once - it is excluded from `rows` on the JS side - so the day isn't summarised twice.
        boolean showFeatured = active != null;
        boolean showAllDone = hasSchedule && active == null;
        views.setViewVisibility(R.id.widget_featured, showFeatured ? android.view.View.VISIBLE : android.view.View.GONE);
        views.setViewVisibility(R.id.widget_featured_alldone, showAllDone ? android.view.View.VISIBLE : android.view.View.GONE);
        if (showFeatured) {
            String subject = active.optString("short", "");
            String name = active.optString("name", "");
            String time = active.optString("time", "");
            String type = active.optString("type", "");
            String room = active.optString("room", "");
            boolean hasPct = active.optBoolean("hasPct", false);

            StringBuilder meta = new StringBuilder(time);
            if (!type.isEmpty()) meta.append(" · ").append(type);
            if (!room.isEmpty()) meta.append(" · ").append(room);

            views.setTextViewText(R.id.widget_featured_label, activeLabel);
            views.setTextViewText(R.id.widget_featured_short, subject);
            views.setTextViewText(R.id.widget_featured_name, name);
            views.setTextViewText(R.id.widget_featured_meta, meta.toString());
            views.setTextViewText(R.id.widget_featured_pct, hasPct ? active.optString("pctText", "–") : "–");
            views.setTextColor(R.id.widget_featured_pct, hasPct ? parseColor(active.optString("color", ""), 0xFF8B8FA3) : 0xFF8B8FA3);
        }

        RemoteViewsCompat.RemoteCollectionItems.Builder itemsBuilder =
            new RemoteViewsCompat.RemoteCollectionItems.Builder().setViewTypeCount(1);
        if (rows != null) {
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row != null) itemsBuilder.addItem(i, buildRow(context, row));
            }
        }
        RemoteViewsCompat.setRemoteAdapter(context, views, appWidgetId, R.id.widget_list, itemsBuilder.build());

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static RemoteViews buildRow(Context context, JSONObject row) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_row);

        String subject = row.optString("short", "");
        String time = row.optString("time", "");
        String type = row.optString("type", "");
        String room = row.optString("room", "");
        boolean isFinished = row.optBoolean("isFinished", false);
        boolean hasPct = row.optBoolean("hasPct", false);

        StringBuilder details = new StringBuilder(time);
        if (!type.isEmpty()) details.append(" · ").append(type);
        if (!room.isEmpty()) details.append(" · ").append(room);

        views.setTextViewText(R.id.row_subject, subject);
        views.setTextViewText(R.id.row_details, details.toString());
        views.setTextViewText(R.id.row_attendance, hasPct ? row.optString("pctText", "–") : "–");

        int mutedColor = 0xFF8B8FA3;
        views.setTextColor(R.id.row_subject, 0xFFE8E9F0);
        views.setTextColor(R.id.row_attendance, hasPct ? parseColor(row.optString("color", ""), mutedColor) : mutedColor);
        // Upcoming classes stay at full brightness; finished ones dim as a whole row rather than
        // recolouring their text, so the day's shape (what's left, what's done) reads at a glance.
        views.setFloat(R.id.row_root, "setAlpha", isFinished ? 0.5f : 1f);

        views.setOnClickFillInIntent(R.id.row_root, new Intent());
        return views;
    }

    private static int parseColor(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }
}
