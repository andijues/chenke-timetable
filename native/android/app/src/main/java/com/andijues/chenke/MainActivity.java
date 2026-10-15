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
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.webkit.*;
import android.view.View;
import android.view.WindowInsets;
import android.widget.LinearLayout;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.ScrollView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
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
    private FrameLayout container;
    private ScrollView startupPanel;
    private TextView startupTitle;
    private TextView startupDetails;
    private boolean bootComplete;
    private String lastStartupError = "";
    private final Handler startupHandler = new Handler(Looper.getMainLooper());
    private final Runnable startupTimeout = () -> {
        if (!bootComplete) showStartupError("页面初始化超过 12 秒。" + (lastStartupError.isEmpty() ? "" : "\n" + lastStartupError));
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { createInterface(); }
        catch (Throwable error) {
            if (container == null) { container = new FrameLayout(this); setContentView(container); }
            if (startupPanel == null) createStartupPanel();
            showStartupError(error.getClass().getSimpleName() + ": " + error.getMessage());
        }
    }
    private void createInterface() {
        container = new FrameLayout(this);
        container.setBackgroundColor(0xfff6f8f7);
        setContentView(container);
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
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
        container.addView(web, new FrameLayout.LayoutParams(-1, -1));
        createStartupPanel();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new NativeBridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            // Some compatible WebViews dispatch only the original String overload.
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return localResource(Uri.parse(url));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localResource(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (own(uri) || ResourcePolicy.engineResource(uri.getScheme())) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) { pageReady = false; }
            @Override public void onPageFinished(WebView view, String url) {
                if (own(Uri.parse(url))) {
                    finishPageInitialization();
                }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!bootComplete && request.isForMainFrame()) showStartupError("页面加载失败：" + error.getErrorCode() + " " + error.getDescription() + "\n地址：" + diagnosticUrl(request.getUrl()));
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse error) {
                if (!bootComplete && request.isForMainFrame()) showStartupError("页面资源加载失败：" + error.getStatusCode() + "\n地址：" + diagnosticUrl(request.getUrl()));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (!bootComplete && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    showStartupError(message.message() + " (line " + message.lineNumber() + ")");
                return true;
            }
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
        loadBundledPage();
    }
    private WebResourceResponse localResource(Uri uri) {
        // Return null so WebView handles its own document/blob machinery. In compatible
        // engines these requests can also reach the legacy interception callback.
        if (ResourcePolicy.engineResource(uri.getScheme())) return null;
        if (!own(uri))
            return response(403, "Forbidden", new ByteArrayInputStream(new byte[0]), "text/plain");
        final String relative;
        try { relative = ResourcePolicy.assetPath(uri.getPath()); }
        catch (IllegalArgumentException error) { return response(403, "Forbidden", new ByteArrayInputStream(new byte[0]), "text/plain"); }
        try { return response(200, "OK", getAssets().open("web/" + relative), mime(relative)); }
        catch (Exception error) {
            // AAPT expands gzip assets. Tesseract detects raw traineddata by its bytes.
            if (relative.endsWith(".traineddata.gz")) {
                try { return response(200, "OK", getAssets().open("web/" + relative.substring(0, relative.length() - 3)), "application/octet-stream"); }
                catch (Exception ignored) {}
            }
            return response(404, "Not Found", new ByteArrayInputStream(new byte[0]), "text/plain");
        }
    }
    private String assetText(String name) throws Exception {
        try (InputStream input = getAssets().open("web/" + name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }
    private void loadBundledPage() {
        bootComplete = false; pageReady = false; lastStartupError = "";
        startupPanel.setVisibility(View.VISIBLE); startupTitle.setText("正在打开晨课…"); startupDetails.setText("");
        startupHandler.removeCallbacks(startupTimeout); startupHandler.postDelayed(startupTimeout, 12_000L);
        try {
            // Supply the initial document, CSS and entry script directly. Home startup must
            // not depend on a DNS lookup or a compatible WebView's resource interception.
            String html = BundledPage.create(assetText("index.html"), assetText("style.css"), assetText("app.js"));
            web.loadDataWithBaseURL(ENTRY, html, "text/html", "UTF-8", ENTRY);
        } catch (Exception error) { showStartupError("读取本机界面失败：" + error.getMessage()); }
    }
    private void finishPageInitialization() {
        pageReady = true;
        for (String reply : replies) script(reply);
        replies.clear(); script("window.chenkeNativeReady && window.chenkeNativeReady()");
        checkStartup();
    }
    private void checkStartup() {
        if (web == null) return;
        web.evaluateJavascript("Boolean(document.getElementById('app') && document.getElementById('app').children.length)", result -> {
            if ("true".equals(result)) {
                bootComplete = true; startupHandler.removeCallbacks(startupTimeout); startupPanel.setVisibility(View.GONE);
            } else if (!lastStartupError.isEmpty()) showStartupError(lastStartupError);
        });
    }
    private void createStartupPanel() {
        startupPanel = new ScrollView(this); startupPanel.setFillViewport(true); startupPanel.setBackgroundColor(0xfff6f8f7);
        LinearLayout body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setGravity(android.view.Gravity.CENTER_VERTICAL);
        int pad = Math.round(24 * getResources().getDisplayMetrics().density); body.setPadding(pad, pad, pad, pad);
        startupTitle = new TextView(this); startupTitle.setTextSize(24); startupTitle.setTextColor(0xff164b42); body.addView(startupTitle);
        startupDetails = new TextView(this); startupDetails.setTextSize(16); startupDetails.setTextColor(0xff344b45);
        startupDetails.setPadding(0, pad, 0, pad); startupDetails.setTextIsSelectable(true); body.addView(startupDetails);
        Button retry = new Button(this); retry.setText("重新打开"); retry.setMinHeight(pad * 2);
        retry.setOnClickListener(v -> { if (web != null) loadBundledPage(); }); body.addView(retry);
        Button copy = new Button(this); copy.setText("复制错误信息"); copy.setMinHeight(pad * 2);
        copy.setOnClickListener(v -> {
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("晨课启动诊断", startupDetails.getText()));
            android.widget.Toast.makeText(this, "已复制，可粘贴反馈", android.widget.Toast.LENGTH_SHORT).show();
        }); body.addView(copy);
        startupPanel.addView(body); container.addView(startupPanel, new FrameLayout.LayoutParams(-1, -1));
    }
    private void showStartupError(String error) {
        lastStartupError = error == null ? "未知初始化错误" : error;
        if (lastStartupError.length() > 900) lastStartupError = lastStartupError.substring(0, 900);
        Log.e("Chenke", lastStartupError);
        runOnUiThread(() -> {
            if (startupPanel == null || isFinishing()) return;
            startupHandler.removeCallbacks(startupTimeout);
            startupTitle.setText("晨课暂时没能打开");
            String engine = "";
            try { if (web != null) engine = "\n\nWebView: " + web.getSettings().getUserAgentString(); } catch (Throwable ignored) {}
            startupDetails.setText(lastStartupError + "\n\nAndroid " + Build.VERSION.RELEASE + " / API " + Build.VERSION.SDK_INT + engine + "\n\n请复制错误信息反馈，以便继续修复。");
            startupPanel.setVisibility(View.VISIBLE);
        });
    }
    private static boolean own(Uri uri) { return ResourcePolicy.ownsOrigin(uri.getScheme(), uri.getHost(), uri.getPort()); }
    private static String diagnosticUrl(Uri uri) {
        if (ResourcePolicy.engineResource(uri.getScheme())) return uri.getScheme() + ":[本机页面]";
        String value = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort()) + uri.getPath();
        return value.length() > 240 ? value.substring(0, 240) : value;
    }
    private static WebResourceResponse response(int status, String reason, java.io.InputStream bytes, String mime) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store"); headers.put("X-Content-Type-Options", "nosniff");
        try { if (bytes.available() > 0) headers.put("Content-Length", String.valueOf(bytes.available())); } catch (Exception ignored) {}
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
        @JavascriptInterface public void pageRendered() { runOnUiThread(() -> finishPageInitialization()); }
        @JavascriptInterface public void startupError(String error) { if (!bootComplete) showStartupError(error); }
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
        startupHandler.removeCallbacks(startupTimeout);
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("AndroidBridge"); web.destroy(); web = null; }
        queue.shutdown(); super.onDestroy();
    }
}
