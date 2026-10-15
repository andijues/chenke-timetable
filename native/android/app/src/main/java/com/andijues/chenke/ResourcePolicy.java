package com.andijues.chenke;

/** Keeps local asset access scoped while accepting standard equivalent HTTPS origins. */
public final class ResourcePolicy {
    private ResourcePolicy() {}
    public static boolean ownsOrigin(String scheme, String host, int port) {
        return "https".equalsIgnoreCase(scheme) && "chenke.local".equalsIgnoreCase(host) && (port == -1 || port == 443);
    }
    public static boolean engineResource(String scheme) {
        return "about".equalsIgnoreCase(scheme) || "data".equalsIgnoreCase(scheme) || "blob".equalsIgnoreCase(scheme);
    }
    public static String assetPath(String path) {
        if (path == null || path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0)
            throw new IllegalArgumentException("界面资源路径无效");
        String relative = path.startsWith("/v3/") ? path.substring(4) : path.startsWith("/") ? path.substring(1) : path;
        return relative.isEmpty() || relative.equals("v3") ? "index.html" : relative;
    }
}
