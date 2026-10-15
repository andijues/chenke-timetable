package com.andijues.chenke;

/** Creates a network-independent startup page; no Android dependency for JVM checks. */
public final class BundledPage {
    private BundledPage() {}
    public static String create(String html, String css, String javascript) {
        String styleTag = "<link rel=\"stylesheet\" href=\"./style.css\">";
        String scriptTag = "<script src=\"./app.js\" defer></script>";
        if (!html.contains(styleTag) || !html.contains(scriptTag))
            throw new IllegalArgumentException("入口文件的界面资源标记不完整");
        String bootstrap = "<script>window.onerror=function(m,u,l){if(window.AndroidBridge)window.AndroidBridge.startupError(String(m)+' (line '+l+')');};window.addEventListener('unhandledrejection',function(e){if(window.AndroidBridge)window.AndroidBridge.startupError(String(e.reason));});</script>";
        String safeScript = javascript.replaceAll("(?i)</script", java.util.regex.Matcher.quoteReplacement("<\\/script"));
        String ready = "<script>if(window.AndroidBridge&&window.AndroidBridge.pageRendered)window.AndroidBridge.pageRendered();</script>";
        return html.replace(styleTag, "<style>" + css + "</style>")
            .replace(scriptTag, bootstrap + "<script>" + safeScript + "</script>" + ready);
    }
}
