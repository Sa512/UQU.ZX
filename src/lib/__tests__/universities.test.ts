import { describe, expect, it } from '@jest/globals';
import { detectLms, feedLabel, searchUniversities, UNIVERSITIES } from '../universities';

describe('learning systems', () => {
  it('detects the LMS from its calendar link', () => {
    expect(detectLms('https://lms.uqu.edu.sa/webapps/calendar/calendarFeed/abc/learn.ics')).toBe('blackboard');
    expect(detectLms('https://moodle.example.edu.sa/calendar/export_execute.php?userid=5&authtoken=x&preset_what=all')).toBe('moodle');
    expect(detectLms('https://example.instructure.com/feeds/calendars/user_abc.ics')).toBe('canvas');
    expect(detectLms('https://uni.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=x')).toBe('d2l');
    expect(detectLms('https://outlook.office365.com/owa/calendar/x/calendar.ics')).toBe('other');
    expect(detectLms('')).toBeNull();
  });

  it('labels feeds with the system and host', () => {
    expect(feedLabel('https://moodle.example.edu.sa/calendar/export_execute.php?x=1')).toBe('Moodle · moodle.example.edu.sa');
    expect(feedLabel('https://calendar.example.com/me.ics')).toBe('calendar.example.com');
  });
});

describe('universities', () => {
  it('has unique names', () => {
    expect(new Set(UNIVERSITIES).size).toBe(UNIVERSITIES.length);
    expect(UNIVERSITIES.length).toBeGreaterThan(30);
  });

  it('suggests ignoring «جامعة», «ال», hamzas and word order', () => {
    expect(searchUniversities('ام القرى')).toEqual(['جامعة أم القرى']);
    expect(searchUniversities('الملك سعود')).toEqual(expect.arrayContaining(['جامعة الملك سعود', 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية']));
    expect(searchUniversities('نوره')).toEqual(['جامعة الأميرة نورة بنت عبدالرحمن']);
    expect(searchUniversities('ج')).toEqual([]);
    expect(searchUniversities('جامعة أم القرى')).toEqual([]); // مكتوبة كاملة: لا اقتراح
  });
});
