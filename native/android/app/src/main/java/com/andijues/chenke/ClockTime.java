package com.andijues.chenke;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** The public Clock intent has no date field: never let a later date become tomorrow. */
public final class ClockTime {
    private ClockTime() {}
    public static long testAt(long now) { return Math.floorDiv(now + 119_999L, 60_000L) * 60_000L; }
    public static ZonedDateTime requireNextOccurrence(long at, long now, ZoneId zone) {
        if (at % 60_000L != 0 || at - now < 60_000L)
            throw new IllegalArgumentException("距离起床时间不足 1 分钟，请直接在手机时钟中核对设置。");
        ZonedDateTime target = Instant.ofEpochMilli(at).atZone(zone);
        ZonedDateTime next = Instant.ofEpochMilli(now).atZone(zone)
            .withHour(target.getHour()).withMinute(target.getMinute()).withSecond(0).withNano(0);
        if (next.toInstant().toEpochMilli() <= now) next = next.plusDays(1);
        if (next.toInstant().toEpochMilli() != at)
            throw new IllegalArgumentException("系统时钟接口不能指定课程日期，请在起床前一天再交接，或在时钟中手动选择日期。");
        return target;
    }
}
