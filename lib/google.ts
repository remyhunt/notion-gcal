import { google, calendar_v3 } from "googleapis";

function getAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
}

function getCalendar() {
  const auth = getAuth();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
}

const calendarId = () => process.env.GOOGLE_CALENDAR_ID!;

export interface GoogleEvent {
  id: string;
  summary: string;
  start: string;
  end: string | null;
  updated: string;
  notionManaged: boolean;
}

function parseEventTime(
  time: calendar_v3.Schema$EventDateTime | undefined
): string | null {
  if (!time) return null;
  return time.dateTime || time.date || null;
}

export async function getGoogleEvents(): Promise<GoogleEvent[]> {
  const calendar = getCalendar();

  // Get events from 30 days ago to 90 days ahead
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 90);

  const response = await calendar.events.list({
    calendarId: calendarId(),
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 500,
  });

  return (response.data.items || [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id!,
      summary: e.summary || "Untitled",
      start: parseEventTime(e.start)!,
      end: parseEventTime(e.end),
      updated: e.updated!,
      notionManaged: e.extendedProperties?.private?.notionManaged === "true",
    }));
}

export async function createGoogleEvent(
  title: string,
  start: string,
  end: string | null
): Promise<string> {
  const calendar = getCalendar();

  const isAllDay = start.length === 10; // YYYY-MM-DD format
  const eventBody: calendar_v3.Schema$Event = {
    summary: title,
    start: isAllDay ? { date: start } : { dateTime: start },
    end: isAllDay
      ? { date: end || start }
      : { dateTime: end || start },
    extendedProperties: {
      private: { notionManaged: "true" },
    },
  };

  const response = await calendar.events.insert({
    calendarId: calendarId(),
    requestBody: eventBody,
  });

  return response.data.id!;
}

export async function updateGoogleEvent(
  eventId: string,
  title: string,
  start: string,
  end: string | null
): Promise<void> {
  const calendar = getCalendar();
  const isAllDay = start.length === 10;

  await calendar.events.update({
    calendarId: calendarId(),
    eventId,
    requestBody: {
      summary: title,
      start: isAllDay ? { date: start } : { dateTime: start },
      end: isAllDay
        ? { date: end || start }
        : { dateTime: end || start },
    },
  });
}

export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const calendar = getCalendar();
  await calendar.events.delete({
    calendarId: calendarId(),
    eventId,
  });
}
