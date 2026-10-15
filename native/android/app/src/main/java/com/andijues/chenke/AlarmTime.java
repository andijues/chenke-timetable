package com.andijues.chenke;

import java.time.OffsetDateTime;

/** No Android dependency: also exercised on the desktop JVM. */
public final class AlarmTime {
    public static final long DAY = 86_400_000L;
    private AlarmTime() {}
    public static long parse(String iso) {
        try { return OffsetDateTime.parse(iso).toInstant().toEpochMilli(); }
        catch (RuntimeException e) { throw new IllegalArgumentException("闹钟时间无效"); }
    }
    public static boolean isFuture(long fireAt, long now) {
        return fireAt > now && fireAt <= now + 30L * DAY;
    }
    public static void validate(String id, long fireAt, long now) {
        if (!id.matches("chenke-\\d{4}-\\d{2}-\\d{2}") || !isFuture(fireAt, now))
            throw new IllegalArgumentException("起床计划无效、已过期或超出 30 天");
    }
}
