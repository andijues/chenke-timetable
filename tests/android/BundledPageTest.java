package com.andijues.chenke;

public final class BundledPageTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    private static void rejects(String html) {
        try { BundledPage.create(html, "", ""); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("broken entry was accepted");
    }
    public static void main(String[] args) {
        String html = "<link rel=\"stylesheet\" href=\"./style.css\"><div id=\"app\"></div><script src=\"./app.js\" defer></script>";
        String result = BundledPage.create(html, "body{color:green}", "window.__sentinel='</ScRiPt><p>test</p>';");
        check(result.contains("<style>body{color:green}</style>"));
        check(!result.contains("src=\"./app.js\""));
        check(result.indexOf("window.onerror") < result.indexOf("window.__sentinel"));
        check(result.contains("<\\/script>") && !result.contains("</ScRiPt>") && result.contains("AndroidBridge.pageRendered"));
        rejects("<link rel=\"stylesheet\" href=\"./style.css\">");
        rejects("<script src=\"./app.js\" defer></script>");
        System.out.println("Android JVM startup page: 6 checks passed");
    }
}
