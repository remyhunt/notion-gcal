import { getNotionPhases, NotionPhase } from "./notion";
import {
  getGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  calendarIdForPhaseType,
  GoogleEvent,
} from "./google";

interface SyncResult {
  notionToGoogle: { created: number; updated: number; deleted: number };
  errors: string[];
}

// Build a unique key for matching: "ProjectName | PhaseName"
function eventKey(projectName: string, phaseTitle: string): string {
  return `${projectName} | ${phaseTitle}`;
}

export async function runSync(): Promise<SyncResult> {
  const result: SyncResult = {
    notionToGoogle: { created: 0, updated: 0, deleted: 0 },
    errors: [],
  };

  const [phases, googleEvents] = await Promise.all([
    getNotionPhases(),
    getGoogleEvents(),
  ]);

  // Index managed Google events by summary
  const googleByKey = new Map<string, GoogleEvent>();
  for (const ge of googleEvents) {
    if (ge.notionManaged) {
      googleByKey.set(ge.summary, ge);
    }
  }

  // Track which Google events are still in Notion
  const matchedKeys = new Set<string>();

  // --- Create & update ---
  for (const phase of phases) {
    const key = eventKey(phase.projectName, phase.title);
    const targetCalId = calendarIdForPhaseType(phase.phaseType);
    try {
      const ge = googleByKey.get(key);
      if (ge) {
        matchedKeys.add(key);
        // If calendar changed (e.g. phase type updated), move it
        if (ge.calendarId !== targetCalId) {
          await deleteGoogleEvent(ge.id, ge.calendarId);
          await createGoogleEvent(key, phase.start, phase.end, targetCalId);
          result.notionToGoogle.updated++;
        } else if (ge.start !== phase.start || ge.end !== phase.end) {
          await updateGoogleEvent(ge.id, key, phase.start, phase.end, targetCalId);
          result.notionToGoogle.updated++;
        }
      } else {
        await createGoogleEvent(key, phase.start, phase.end, targetCalId);
        matchedKeys.add(key);
        result.notionToGoogle.created++;
      }
    } catch (err: any) {
      result.errors.push(`Notion→Google (${key}): ${err.message}`);
    }
  }

  // --- Delete managed Google events no longer in Notion ---
  for (const ge of googleEvents) {
    if (ge.notionManaged && !matchedKeys.has(ge.summary)) {
      try {
        await deleteGoogleEvent(ge.id, ge.calendarId);
        result.notionToGoogle.deleted++;
      } catch (err: any) {
        result.errors.push(`Delete Google (${ge.summary}): ${err.message}`);
      }
    }
  }

  return result;
}
