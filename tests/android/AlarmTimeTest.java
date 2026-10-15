package com.andijues.chenke;

public final class AlarmTimeTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    private static void rejects(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("invalid plan was accepted");
    }
    public static void main(String[] args) {
        long now = AlarmTime.parse("2026-10-15T00:00:00+08:00");
        check(AlarmTime.parse("2026-10-15T07:00:00+08:00") == AlarmTime.parse("2026-10-14T23:00:00Z"));
        rejects(() -> AlarmTime.parse("2026-99-99T07:00"));
        rejects(() -> AlarmTime.validate("unrelated-app-alarm", now + 60_000L, now));
        rejects(() -> AlarmTime.validate("chenke-2026-10-15", now, now));
        rejects(() -> AlarmTime.validate("chenke-2026-10-15", now - 60_000L, now));
        rejects(() -> AlarmTime.validate("chenke-2026-11-15", now + 31 * AlarmTime.DAY, now));
        AlarmTime.validate("chenke-2026-10-16", now + AlarmTime.DAY, now);
        System.out.println("Android JVM alarm time: 7 checks passed");
    }
}
