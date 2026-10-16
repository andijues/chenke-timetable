package com.andijues.chenke;
import java.time.Instant;
import java.time.ZoneId;
public final class ClockTimeTest {
    private static long at(String iso) { return Instant.parse(iso).toEpochMilli(); }
    private static void check(boolean ok) { if(!ok)throw new AssertionError(); }
    private static void rejects(long target,long now) {
        try {ClockTime.requireNextOccurrence(target,now,ZoneId.of("Asia/Shanghai"));}
        catch(IllegalArgumentException expected){return;}
        throw new AssertionError("Unsafe clock date was accepted");
    }
    public static void main(String[] args) {
        ZoneId zone=ZoneId.of("Asia/Shanghai");long now=at("2026-10-15T12:00:00Z");
        check(ClockTime.requireNextOccurrence(at("2026-10-15T23:00:00Z"),now,zone).getHour()==7);
        check(ClockTime.requireNextOccurrence(at("2026-10-15T13:00:00Z"),now,zone).getHour()==21);
        check(ClockTime.requireNextOccurrence(at("2026-10-16T12:00:00Z"),now,zone).getDayOfMonth()==16);
        rejects(at("2026-10-16T13:00:00Z"),now);
        rejects(at("2026-10-17T23:00:00Z"),now);
        rejects(now-60_000,now);rejects(now+59_000,now);rejects(now+61_000,now);
        check(ClockTime.testAt(now)==now+60_000);
        long seconds=now+31_000;long test=ClockTime.testAt(seconds);
        check(test-seconds>=60_000&&test-seconds<120_000&&test%60_000==0);
        check(ClockTime.requireNextOccurrence(at("2026-10-15T23:00:00Z"),now,ZoneId.of("Europe/London")).getHour()==0);
        ClockTime.requireTomorrowCourse("2026-10-16",now);
        for(String bad:new String[]{"2026-10-15","2026-10-17","bad"}){
            boolean rejected=false;try{ClockTime.requireTomorrowCourse(bad,now);}catch(IllegalArgumentException expected){rejected=true;}check(rejected);
        }
        ClockTime.requireTomorrowCourse("2026-10-16",at("2026-10-15T15:59:00Z"));
        System.out.println("Android JVM system Clock dates: 16 checks passed");
    }
}
