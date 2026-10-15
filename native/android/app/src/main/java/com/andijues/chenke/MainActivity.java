package com.andijues.chenke;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.*;
import android.view.View;
import android.view.WindowInsets;
import android.widget.LinearLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://chenke.local";
    private static final String ENTRY = ORIGIN + "/v3/index.html";
    private static final int FILE_PICK = 100, FILE_SAVE = 101, NOTIFY = 102;
    private WebView web;
    private boolean pageReady;
    private final ArrayList<String> replies = new ArrayList<>();
    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private ValueCallback<Uri[]> fileCallback;
    private JSONObject exportRequest;
    private JSONObject permissionRequest;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        LinearLayout container = new LinearLayout(this);
        container.setBackgroundColor(0xfff6f8f7);
        // Target 36 edge-to-edge: consume system/IME insets in the native host.
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
        });
        web = new WebView(this);
        container.addView(web, new LinearLayout.LayoutParams(-1, -1)); setContentView(container);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new NativeBridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl(); String path = uri.getPath();
                if (!own(uri) || path == null || !path.startsWith("/v3/") || path.contains("..") || path.contains("\\"))
                    return response(403, "Forbidden", new ByteArrayInputStream(new byte[0]), "text/plain");
                String relative = path.substring(4);
                try { return response(200, "OK", getAssets().open("web/" + relative), mime(relative)); }
                catch (Exception e) {
                    // AAPT expands .gz assets and strips the suffix. Tesseract accepts raw
                    // traineddata too (it detects gzip by magic bytes, not the requested URL).
                    if (relative.endsWith(".traineddata.gz")) {
                        try { return response(200, "OK", getAssets().open("web/" + relative.substring(0, relative.length() - 3)), "application/octet-stream"); }
                        catch (Exception ignored) {}
                    }
                    return response(404, "Not Found", new ByteArrayInputStream(new byte[0]), "text/plain");
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (own(uri) && uri.getPath() != null && uri.getPath().startsWith("/v3/")) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) { pageReady = false; }
            @Override public void onPageFinished(WebView view, String url) {
                if (own(Uri.parse(url))) {
                    pageReady = true;
                    for (String reply : replies) script(reply);
                    replies.clear(); script("window.chenkeNativeReady?.()");
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                    .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "image/*", "application/json"});
                try { startActivityForResult(pick, FILE_PICK); } catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("确定", (d, w) -> result.confirm()).setNegativeButton("取消", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel()).show(); return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("知道了", (d, w) -> result.confirm()).setOnCancelListener(d -> result.confirm()).show(); return true;
            }
        });
        web.loadUrl(ENTRY);
    }
    private static boolean own(Uri uri) { return "https".equals(uri.getScheme()) && "chenke.local".equals(uri.getHost()) && uri.getPort() == -1; }
    private static WebResourceResponse response(int status, String reason, java.io.InputStream bytes, String mime) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store"); headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null,
            status, reason, headers, bytes);
    }
    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".gz")) return "application/gzip";
        return "application/octet-stream";
    }
    private void script(String javascript) {
        if (web != null && pageReady && !isFinishing()) web.evaluateJavascript(javascript, null);
    }
    private void reply(JSONObject message, JSONObject data, String error) {
        try {
            JSONObject result = new JSONObject().put("id", message.getString("id"));
            if (error != null) result.put("error", error); else result.put("data", data);
            runOnUiThread(() -> {
                String js = "window.chenkeNativeResult?.(" + result + ")";
                if (pageReady) script(js); else if (replies.size() < 32) replies.add(js);
            });
        } catch (Exception ignored) {}
    }
    public final class NativeBridge {
        @JavascriptInterface public void postMessage(String raw) {
            if (raw == null || raw.length() > 5_000_000) return;
            runOnUiThread(() -> {
                if (web == null || !own(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                try {
                    JSONObject m = new JSONObject(raw);
                    if (!m.has("id") || !m.has("action")) return;
                    String action = m.getString("action");
                    if ("requestPermissions".equals(action)) { permissionRequest = m; requestNextPermission(); }
                    else if ("exportFile".equals(action)) beginExport(m);
                    else queue.execute(() -> execute(m));
                } catch (Exception ignored) {}
            });
        }
    }
    private void execute(JSONObject m) {
        try {
            JSONObject p = m.optJSONObject("payload"); if (p == null) p = new JSONObject();
            SharedPreferences storage = getSharedPreferences("chenke", MODE_PRIVATE);
            AlarmStore alarms = new AlarmStore(this); JSONObject data;
            switch (m.getString("action")) {
                case "capabilities": data = alarms.capabilities(); break;
                case "loadState":
                    String value = storage.getString("state", "");
                    data = new JSONObject(); if (!value.isEmpty()) data.put("state", new JSONObject(value)); break;
                case "saveState":
                    if (!storage.edit().putString("state", p.getJSONObject("state").toString()).commit()) throw new Exception("设备保存失败");
                    data = new JSONObject().put("saved", true); break;
                case "syncAlarms": data = alarms.synchronize(p.getJSONArray("plans")); break;
                case "testAlarm": data = alarms.test(); break;
                default: throw new IllegalArgumentException("不支持的设备操作");
            }
            reply(m, data, null);
        } catch (Exception e) { reply(m, null, e.getMessage() == null ? "设备操作失败" : e.getMessage()); }
    }
    private void requestNextPermission() {
        try {
            AlarmStore alarms = new AlarmStore(this);
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFY); return;
            }
            if (!alarms.notificationsAllowed()) {
                startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
            } else if (!alarms.exactAllowed()) {
                startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
            } else if (!alarms.fullScreenAllowed() && Build.VERSION.SDK_INT >= 34) {
                startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getPackageName())));
            } else {
                reply(permissionRequest, alarms.capabilities(), null); permissionRequest = null;
            }
        } catch (Exception e) {
            if (permissionRequest != null) reply(permissionRequest, null, "无法打开系统权限页，请在设置中为晨课开启通知、准确闹钟和锁屏显示。");
            permissionRequest = null;
        }
    }
    private void beginExport(JSONObject m) {
        try {
            if (exportRequest != null) throw new Exception("请先完成上一次保存");
            JSONObject p = m.getJSONObject("payload");
            String name = p.optString("name", "晨课备份.json").replaceAll("[/\\\\]", "_");
            Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(p.optString("type", "application/json")).putExtra(Intent.EXTRA_TITLE, name);
            exportRequest = m; startActivityForResult(save, FILE_SAVE);
        } catch (Exception e) { exportRequest = null; reply(m, null, "无法打开文件保存器"); }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == NOTIFY && permissionRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) requestNextPermission();
            else { reply(permissionRequest, null, "通知权限未开启，请在设置中允许后重试。"); permissionRequest = null; }
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FILE_PICK && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null ? new Uri[]{data.getData()} : null); fileCallback = null;
        }
        if (request == FILE_SAVE && exportRequest != null) {
            JSONObject m = exportRequest; exportRequest = null;
            if (result != RESULT_OK || data == null || data.getData() == null) { reply(m, null, "已取消保存"); return; }
            Uri uri = data.getData();
            queue.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new Exception("无法写入文件");
                    out.write(m.getJSONObject("payload").getString("text").getBytes(StandardCharsets.UTF_8));
                    reply(m, new JSONObject().put("exported", true), null);
                } catch (Exception e) { reply(m, null, "文件保存失败，请选择可写入的文件夹"); }
            });
        }
    }
    @Override protected void onResume() {
        super.onResume();
        if (permissionRequest != null) {
            // One settings page per click: a denied permission must never create a settings loop.
            JSONObject m = permissionRequest; permissionRequest = null;
            try { reply(m, new AlarmStore(this).capabilities(), null); } catch (Exception e) { reply(m, null, "权限检查失败"); }
        }
        if (pageReady) script("window.chenkeNativeResume?.()");
    }
    private void handleBack() {
        if (!pageReady) { moveTaskToBack(true); return; }
        web.evaluateJavascript("(function(){const d=document.querySelector('#course-dialog');if(d?.open){d.close();return true;}if(!document.querySelector('.nav-item.active[data-route=home]')){document.querySelector('.nav-item[data-route=home]')?.click();return true;}return false;})()", handled -> {
            if ("false".equals(handled)) moveTaskToBack(true);
        });
    }
    // API 33+ uses the registered OnBackInvokedDispatcher; this fallback serves 26-32.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onDestroy() {
        pageReady = false;
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("AndroidBridge"); web.destroy(); web = null; }
        queue.shutdown(); super.onDestroy();
    }
}
