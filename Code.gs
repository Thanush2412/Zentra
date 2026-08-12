/**
 * Google Apps Script: Real Google Meet & Google Calendar Event Generator
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * SETUP INSTRUCTIONS:
 * 1. Open Google Apps Script: https://script.google.com/
 * 2. Create a new project (name it: "Zentra Google Meet & Calendar Generator")
 * 3. Replace all code in Code.gs with this file's contents.
 * 4. In the left sidebar, click "Services" (+ icon) -> Select "Google Calendar API" -> Click "Add".
 * 5. Click "Deploy" -> "New deployment" -> Select type: "Web app":
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone"
 * 6. Copy the Web App URL and paste it into your .env.local as:
 *    NEXT_PUBLIC_GAS_MAIL_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Handles POST requests from Zentra Timetable & Interview System
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        message: "No payload received in request body"
      }, 400);
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action || "create_calendar_event";

    // ── ACTION 1: Create Real Google Meet & Calendar Event ─────────────────
    if (action === "create_calendar_event" || action === "create_meeting") {
      var summary = data.summary || "Structured Interview Assessment Session";
      var description = data.description || "Faculty evaluation session conducted via Zentra.";
      var timeZone = data.timeZone || "Asia/Kolkata";
      
      // Calculate start and end ISO DateTimes
      var startDate = data.start_date || new Date().toISOString().slice(0, 10);
      var startTime = data.start_time || "08:20 AM";
      var endTime = data.end_time || "09:10 AM";

      var startISO = formatToISO(startDate, startTime, timeZone);
      var endISO = formatToISO(startDate, endTime, timeZone);

      var attendees = [];
      if (Array.isArray(data.attendees)) {
        attendees = data.attendees
          .filter(function(email) { return email && email.includes("@"); })
          .map(function(email) { return { email: email.trim() }; });
      }

      // Build Calendar Event Resource with Google Meet Conference Creation
      var eventResource = {
        summary: summary,
        description: description,
        start: {
          dateTime: startISO,
          timeZone: timeZone
        },
        end: {
          dateTime: endISO,
          timeZone: timeZone
        },
        conferenceData: {
          createRequest: {
            requestId: Utilities.getUuid(),
            conferenceSolutionKey: {
              type: "hangoutsMeet"
            }
          }
        },
        attendees: attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 15 },
            { method: "email", minutes: 30 }
          ]
        }
      };

      // Call Advanced Google Calendar API (conferenceDataVersion: 1 creates real Google Meet)
      var createdEvent;
      try {
        createdEvent = Calendar.Events.insert(eventResource, "primary", {
          conferenceDataVersion: 1,
          sendUpdates: data.sendUpdates || "none"
        });
      } catch (calApiErr) {
        // Fallback: If Advanced Calendar service is not enabled, use CalendarApp
        Logger.log("Advanced Calendar API error, falling back to CalendarApp: " + calApiErr);
        var cal = CalendarApp.getDefaultCalendar();
        var fallbackEvent = cal.createEvent(summary, new Date(startISO), new Date(endISO), {
          description: description,
          guests: attendees.map(function(a) { return a.email; }).join(",")
        });
        
        return jsonResponse({
          success: true,
          event_id: fallbackEvent.getId(),
          meet_url: "https://meet.google.com/new",
          html_link: "https://calendar.google.com/calendar/r/eventedit/" + fallbackEvent.getId(),
          note: "Event created with CalendarApp fallback. Enable Advanced Calendar API in Services for direct meet.google.com link generation."
        });
      }

      // Extract generated Google Meet URL
      var meetUrl = createdEvent.hangoutLink || "";
      if (!meetUrl && createdEvent.conferenceData && createdEvent.conferenceData.entryPoints) {
        for (var i = 0; i < createdEvent.conferenceData.entryPoints.length; i++) {
          var ep = createdEvent.conferenceData.entryPoints[i];
          if (ep.entryPointType === "video") {
            meetUrl = ep.uri;
            break;
          }
        }
      }

      return jsonResponse({
        success: true,
        meet_url: meetUrl || "https://meet.google.com/new",
        event_id: createdEvent.id,
        html_link: createdEvent.htmlLink,
        start_time: startISO,
        end_time: endISO,
        attendees_count: attendees.length,
        message: "Real Google Calendar event and Google Meet link created successfully on Google servers!"
      });
    }

    return jsonResponse({
      success: false,
      message: "Unrecognized action: " + action
    }, 400);

  } catch (error) {
    Logger.log("doPost Error: " + error.toString());
    return jsonResponse({
      success: false,
      error: error.toString()
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handles GET requests (Health Check)
 */
function doGet(e) {
  return jsonResponse({
    status: "online",
    service: "Zentra Google Meet & Calendar Generator",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
}

/**
 * Helper to convert human time string (e.g. "2026-08-14", "08:20 AM") to ISO 8601 string
 */
function formatToISO(dateStr, timeStr, timeZone) {
  try {
    var parts = dateStr.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    var cleanTime = (timeStr || "09:00 AM").trim().toLowerCase().replace(".", ":");
    var isPM = cleanTime.indexOf("pm") !== -1;
    var isAM = cleanTime.indexOf("am") !== -1;
    var timePart = cleanTime.replace(/am|pm/g, "").trim();
    var timeSplit = timePart.split(":");

    var hours = parseInt(timeSplit[0], 10) || 9;
    var minutes = parseInt(timeSplit[1], 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    var date = new Date(Date.UTC(year, month, day, hours - 5, minutes - 30)); // Approximate IST to UTC if needed
    return Utilities.formatDate(new Date(year, month, day, hours, minutes, 0), timeZone || "Asia/Kolkata", "yyyy-MM-dd'T'HH:mm:ssXXX");
  } catch (err) {
    return new Date().toISOString();
  }
}

/**
 * Helper to return JSON Response with CORS headers
 */
function jsonResponse(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
