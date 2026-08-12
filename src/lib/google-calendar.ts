/**
 * Google Calendar & Google Meet Integration Service
 * 
 * Provides:
 * 1. Real Google Calendar Event creation via Google Apps Script Webhook
 * 2. 1-Click "Add to Google Calendar" URL generator (pre-populated with title, timings, Google Meet link & attendee emails)
 * 3. Standard Google Meet URL generator (3-4-3 lowercase alphabetic room codes, e.g. meet.google.com/abc-defg-hij)
 * 4. RFC-5545 compliant iCalendar (.ics) event string generator
 */

export interface GoogleCalendarEventOptions {
  title: string;
  description?: string;
  targetDate: string; // YYYY-MM-DD
  startTime?: string; // e.g. "08:20 AM" or "8.20 AM"
  endTime?: string;   // e.g. "09:10 AM" or "9.10 AM"
  attendees?: string[]; // email addresses
  existingMeetLink?: string | null;
  interviewId?: string;
}

export interface GoogleCalendarResult {
  gmeet_link: string;
  gcal_link: string;
  meet_id: string;
  ics_content: string;
  event_created?: boolean;
}

/**
 * Generate a standard Google Meet room code (strictly 3-4-3 lowercase letters)
 */
export function generateGoogleMeetCode(seed?: string): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const getChunk = (len: number) => {
    let res = "";
    for (let i = 0; i < len; i++) {
      res += letters[Math.floor(Math.random() * letters.length)];
    }
    return res;
  };
  return `${getChunk(3)}-${getChunk(4)}-${getChunk(3)}`;
}

/**
 * Parse human time (e.g. "08:20 AM" or "8.20 AM") on targetDate (YYYY-MM-DD) into ISO string for Google Calendar
 */
export function formatGCalDateTime(dateStr: string, timeStr?: string): { startISO: string; endISO: string } {
  const cleanDate = dateStr && dateStr.includes("-") ? dateStr : new Date().toISOString().slice(0, 10);
  
  const parseHourMin = (t?: string, defaultHour = 9, defaultMin = 0) => {
    if (!t) return { hour: defaultHour, minute: defaultMin };
    const cleaned = t.trim().toLowerCase().replace(".", ":");
    const isPM = cleaned.includes("pm");
    const isAM = cleaned.includes("am");
    const timePart = cleaned.replace(/am|pm/g, "").trim();
    const parts = timePart.split(":");
    let h = parseInt(parts[0], 10) || defaultHour;
    const m = parseInt(parts[1], 10) || defaultMin;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return { hour: h, minute: m };
  };

  const start = parseHourMin(timeStr, 8, 20);
  const end = { hour: start.hour, minute: start.minute + 50 };
  if (end.minute >= 60) {
    end.hour += Math.floor(end.minute / 60);
    end.minute = end.minute % 60;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = cleanDate.replace(/-/g, "");

  const startISO = `${ymd}T${pad(start.hour)}${pad(start.minute)}00`;
  const endISO = `${ymd}T${pad(end.hour)}${pad(end.minute)}00`;

  return { startISO, endISO };
}

/**
 * Creates Google Calendar Event with Google Meet conference & 1-click URL
 */
export async function createGoogleCalendarEvent(options: GoogleCalendarEventOptions): Promise<GoogleCalendarResult> {
  const {
    title,
    description = "Structured Interview Assessment Session",
    targetDate,
    startTime = "08:20 AM",
    endTime = "09:10 AM",
    attendees = [],
    existingMeetLink,
    interviewId = ""
  } = options;

  // 1. Resolve standard Google Meet link (3-4-3 lowercase letters)
  let gmeetLink = existingMeetLink && existingMeetLink.includes("meet.google.com")
    ? existingMeetLink
    : `https://meet.google.com/${generateGoogleMeetCode()}`;

  const { startISO, endISO } = formatGCalDateTime(targetDate, startTime);

  // 2. Generate 1-Click "Add to Google Calendar" Template Link
  const gcalDetails = `${description}\n\nJoin Google Meet: ${gmeetLink}`;
  const gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(gcalDetails)}&location=${encodeURIComponent(gmeetLink)}&add=${encodeURIComponent(attendees.filter(Boolean).join(","))}`;

  // 3. Try to call Google Apps Script Webhook to create real Google Calendar Event if configured
  let eventCreated = false;
  let effectiveGcalLink = gcalLink;
  const gasUrl = process.env.NEXT_PUBLIC_GAS_MAIL_URL || "";
  if (gasUrl) {
    try {
      const response = await fetch(gasUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "create_calendar_event",
          summary: title,
          description: gcalDetails,
          start_date: targetDate,
          start_time: startTime,
          end_time: endTime,
          timeZone: "Asia/Kolkata",
          attendees: attendees.filter(Boolean),
          conference: true
        })
      });
      if (response.ok) {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (data.meet_url) {
            gmeetLink = data.meet_url;
          }
          if (data.html_link) {
            effectiveGcalLink = data.html_link;
          }
          eventCreated = true;
        } catch (_) {}
      }
    } catch (gasErr) {
      console.warn("GAS Calendar event trigger error (fallback used):", gasErr);
    }
  }

  // 4. Generate RFC-5545 iCalendar content
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FACE Prep//Zentra Interview System//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:interview_${interviewId || Date.now()}@faceprep.in`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${startISO}`,
    `DTEND:${endISO}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${gcalDetails.replace(/\n/g, "\\n")}`,
    `LOCATION:${gmeetLink}`,
    `URL:${gmeetLink}`,
    `X-GOOGLE-CONFERENCE:${gmeetLink}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const meetId = gmeetLink.replace("https://meet.google.com/", "");

  return {
    gmeet_link: gmeetLink,
    gcal_link: effectiveGcalLink || gcalLink,
    meet_id: meetId,
    ics_content: icsContent,
    event_created: eventCreated
  };
}
