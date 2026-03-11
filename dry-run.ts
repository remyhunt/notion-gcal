import "dotenv/config";
import { getNotionPhases } from "./lib/notion";
import { getGoogleEvents, calendarIdForPhaseType, CALENDAR_IDS } from "./lib/google";

function calLabel(calId: string): string {
  for (const [name, id] of Object.entries(CALENDAR_IDS)) {
    if (id === calId) return name;
  }
  return "unknown";
}

function eventKey(projectName: string, phaseTitle: string): string {
  return `${projectName} | ${phaseTitle}`;
}

async function main() {
  console.log("Fetching Notion phases and Google events...\n");

  const [phases, googleEvents] = await Promise.all([
    getNotionPhases(),
    getGoogleEvents(),
  ]);

  // Index managed Google events by summary
  const googleByKey = new Map<string, (typeof googleEvents)[0]>();
  for (const ge of googleEvents) {
    if (ge.notionManaged) {
      googleByKey.set(ge.summary, ge);
    }
  }

  const matchedKeys = new Set<string>();
  const actions: string[] = [];

  // --- What would be created or updated ---
  for (const phase of phases) {
    const key = eventKey(phase.projectName, phase.title);
    const targetCalId = calendarIdForPhaseType(phase.phaseType);
    const target = calLabel(targetCalId);

    const ge = googleByKey.get(key);
    if (ge) {
      matchedKeys.add(key);
      const currentCal = calLabel(ge.calendarId);
      if (ge.calendarId !== targetCalId) {
        actions.push(`MOVE    [${currentCal} → ${target}] ${key}`);
      } else if (ge.start !== phase.start || ge.end !== phase.end) {
        actions.push(`UPDATE  [${target}] ${key} | ${ge.start} → ${phase.start}`);
      } else {
        // no change
      }
    } else {
      matchedKeys.add(key);
      const dateStr = `${phase.start}${phase.end ? ` → ${phase.end}` : ""}`;
      actions.push(`CREATE  [${target}] ${key} | ${dateStr}`);
    }
  }

  // --- What would be deleted ---
  for (const ge of googleEvents) {
    if (ge.notionManaged && !matchedKeys.has(ge.summary)) {
      actions.push(`DELETE  [${calLabel(ge.calendarId)}] ${ge.summary}`);
    }
  }

  // --- Output ---
  if (actions.length === 0) {
    console.log("Everything is in sync. No changes needed.");
  } else {
    console.log(`${actions.length} actions would be taken:\n`);
    for (const a of actions) {
      console.log(`  ${a}`);
    }
  }

  // --- Summary ---
  const creates = actions.filter(a => a.startsWith("CREATE")).length;
  const updates = actions.filter(a => a.startsWith("UPDATE")).length;
  const moves = actions.filter(a => a.startsWith("MOVE")).length;
  const deletes = actions.filter(a => a.startsWith("DELETE")).length;

  console.log();
  console.log("=== DRY RUN SUMMARY ===");
  console.log(`Create: ${creates}`);
  console.log(`Update: ${updates}`);
  console.log(`Move:   ${moves}`);
  console.log(`Delete: ${deletes}`);

  // --- Calendar breakdown ---
  console.log();
  console.log("=== PHASES BY CALENDAR ===");
  const calCounts: Record<string, number> = {};
  for (const phase of phases) {
    const target = calLabel(calendarIdForPhaseType(phase.phaseType));
    calCounts[target] = (calCounts[target] || 0) + 1;
  }
  for (const [cal, count] of Object.entries(calCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cal}: ${count} phases`);
  }

  console.log();
  console.log("=== EXISTING GOOGLE EVENTS ===");
  console.log(`Total: ${googleEvents.length}`);
  console.log(`Managed by sync: ${[...googleByKey.values()].length}`);
  console.log(`Unmanaged (won't be touched): ${googleEvents.length - [...googleByKey.values()].length}`);
}

main().catch(console.error);
