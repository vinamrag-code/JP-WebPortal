package com.jportal.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the web app's schedule snapshot into the native home-screen widget: stores the JSON blob the
 * widget reads from, redraws any pinned instances, and (on Android 8+) asks the launcher to prompt the
 * user to pin one.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    public static final String PREFS_NAME = "jportal_widget_prefs";
    public static final String KEY_SNAPSHOT = "snapshot_json";

    @PluginMethod
    public void syncWidgetData(PluginCall call) {
        String json = call.getString("json", "{}");
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_SNAPSHOT, json).apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, ScheduleWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(provider);
        ScheduleWidgetProvider.updateAllWidgets(context, mgr, ids);

        call.resolve();
    }

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        Context context = getContext();
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        JSObject ret = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !mgr.isRequestPinAppWidgetSupported()) {
            ret.put("supported", false);
            call.resolve(ret);
            return;
        }

        ComponentName provider = new ComponentName(context, ScheduleWidgetProvider.class);
        boolean accepted = mgr.requestPinAppWidget(provider, null, null);
        ret.put("supported", true);
        ret.put("accepted", accepted);
        call.resolve(ret);
    }
}
