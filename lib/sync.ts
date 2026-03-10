import {
  getNotionEvents,
  createNotionEvent,
  updateNotionEvent,
  NotionEvent,
} from "./notion";
import {
  getGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  GoogleEvent,
} from "./google";

interface SyncResult {
  notionToGoogle: { created: number; updated: number };
  googleToNotion: { created: number; updated: number };
  errors: string[];
}

export async function runSync(): Promise<SyncResult> {
  const result: SyncResult = {
    notionToGoogle: { created: 0, updated: 0 },
    googleToNotion: { created: 0, updated: 0 },
    errors: [],
  };

  const [notionEvents, googleEvents] = await Promise.all([
    getNotionEvents(),
    getGoogleEvents(),
  ]);

  // Index Google events by ID for quick lookup
  const googleById = new Map<string, GoogleEvent>();
  for (const ge of googleEvents) {
    googleById.set(ge.id, ge);
  }

  // Index Notion events by Google Event ID
  const notionByGoogleId = new Map<string, NotionEvent>();
  for (const ne of notionEvents) {
    if (ne.googleEventId) {
      notionByGoogleId.set(ne.googleEventId, ne);
    }
  }

  // --- Notion → Google ---
  for (const ne of notionEvents) {
    try {
      if (ne.googleEventId) {
        // Already linked — update Google event
        const ge = googleById.get(ne.googleEventId);
        if (ge) {
          // Only update if Notion was edited more recently
          if (ne.lastSynced && new Date(ge.updated) <= new Date(ne.lastSynced)) {
            // Check if Notion data differs from Google
            if (ge.summary !== ne.title || ge.start !== ne.start || ge.end !== ne.end) {
              await updateGoogleEvent(ne.googleEventId, ne.title, ne.start, ne.end);
              await updateNotionEvent(ne.pageId, {});
              result.notionToGoogle.updated++;
            }
          }
        }
      } else {
        // No Google Event ID — create in Google
        const googleEventId = await createGoogleEvent(ne.title, ne.start, ne.end);
        await updateNotionEvent(ne.pageId, { googleEventId });
        result.notionToGoogle.created++;
      }
    } catch (err: any) {
      result.errors.push(`Notion→Google (${ne.title}): ${err.message}`);
    }
  }

  // --- Google → Notion ---
  for (const ge of googleEvents) {
    try {
      const existingNotion = notionByGoogleId.get(ge.id);
      if (existingNotion) {
        // Already linked — update Notion if Google is newer
        if (
          existingNotion.lastSynced &&
          new Date(ge.updated) > new Date(existingNotion.lastSynced)
        ) {
          await updateNotionEvent(existingNotion.pageId, {
            title: ge.summary,
            start: ge.start,
            end: ge.end,
          });
          result.googleToNotion.updated++;
        }
      } else {
        // Not in Notion yet — create it
        await createNotionEvent(ge.summary, ge.start, ge.end, ge.id);
        result.googleToNotion.created++;
      }
    } catch (err: any) {
      result.errors.push(`Google→Notion (${ge.summary}): ${err.message}`);
    }
  }

  return result;
}
