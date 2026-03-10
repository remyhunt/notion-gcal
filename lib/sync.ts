import { getNotionEvents, NotionEvent } from "./notion";
import {
  getGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  GoogleEvent,
} from "./google";

interface SyncResult {
  notionToGoogle: { created: number; updated: number; deleted: number };
  errors: string[];
}

export async function runSync(): Promise<SyncResult> {
  const result: SyncResult = {
    notionToGoogle: { created: 0, updated: 0, deleted: 0 },
    errors: [],
  };

  const [notionEvents, googleEvents] = await Promise.all([
    getNotionEvents(),
    getGoogleEvents(),
  ]);

  // Index Google events by title (only notionManaged ones for matching)
  const googleByTitle = new Map<string, GoogleEvent>();
  for (const ge of googleEvents) {
    if (ge.notionManaged) {
      googleByTitle.set(ge.summary, ge);
    }
  }

  // Track which managed Google events are still in Notion
  const matchedGoogleTitles = new Set<string>();

  // --- Notion → Google: create & update ---
  for (const ne of notionEvents) {
    try {
      const ge = googleByTitle.get(ne.title);
      if (ge) {
        matchedGoogleTitles.add(ne.title);
        // Update Google if date differs
        if (ge.start !== ne.start || ge.end !== ne.end) {
          await updateGoogleEvent(ge.id, ne.title, ne.start, ne.end);
          result.notionToGoogle.updated++;
        }
      } else {
        // No matching Google event — create it
        await createGoogleEvent(ne.title, ne.start, ne.end);
        matchedGoogleTitles.add(ne.title);
        result.notionToGoogle.created++;
      }
    } catch (err: any) {
      result.errors.push(`Notion→Google (${ne.title}): ${err.message}`);
    }
  }

  // --- Deletions: remove managed Google events no longer in Notion ---
  for (const ge of googleEvents) {
    if (ge.notionManaged && !matchedGoogleTitles.has(ge.summary)) {
      try {
        await deleteGoogleEvent(ge.id);
        result.notionToGoogle.deleted++;
      } catch (err: any) {
        result.errors.push(`Delete Google (${ge.summary}): ${err.message}`);
      }
    }
  }

  return result;
}
