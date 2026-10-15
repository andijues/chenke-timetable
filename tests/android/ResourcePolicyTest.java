package com.andijues.chenke;
public final class ResourcePolicyTest {
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    private static void rejects(String path) {
        try { ResourcePolicy.assetPath(path); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("invalid asset path was accepted");
    }
    public static void main(String[] args) {
        check(ResourcePolicy.ownsOrigin("https", "chenke.local", -1));
        check(ResourcePolicy.ownsOrigin("HTTPS", "CHENKE.LOCAL", 443));
        check(!ResourcePolicy.ownsOrigin("http", "chenke.local", 80));
        check(!ResourcePolicy.ownsOrigin("https", "external.invalid", 443));
        check(!ResourcePolicy.ownsOrigin("https", "chenke.local", 444));
        check(ResourcePolicy.engineResource("data") && ResourcePolicy.engineResource("blob") && ResourcePolicy.engineResource("about"));
        check(!ResourcePolicy.engineResource("https"));
        check(ResourcePolicy.assetPath("/v3/app.js").equals("app.js"));
        check(ResourcePolicy.assetPath("/").equals("index.html") && ResourcePolicy.assetPath("/v3").equals("index.html"));
        check(ResourcePolicy.assetPath("/vendor/ocr/worker.min.js").equals("vendor/ocr/worker.min.js"));
        rejects("/../private"); rejects("/vendor\\private"); rejects("/vendor/\0private");
        System.out.println("Android JVM resource policy: 13 checks passed");
    }
}
