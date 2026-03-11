import "dotenv/config";
import { Client } from "@notionhq/client";
import { calendarIdForPhaseType, CALENDAR_IDS } from "./lib/google";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

async function main() {
  console.log("=== CONFIG ===");
  console.log(`NOTION_DATABASE_ID: ${databaseId}`);
  console.log(`NOTION_TOKEN: ${process.env.NOTION_TOKEN?.slice(0, 10)}...`);
  console.log(`Default calendar: ${CALENDAR_IDS.default}`);
  console.log(`Development calendar: ${CALENDAR_IDS.Development}`);
  console.log();

  // --- Database ---
  console.log("=== DATABASE ===");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  console.log(`Name: ${(db as any).title?.[0]?.plain_text}`);
  const dataSources = (db as any).data_sources || [];
  const dsId = dataSources[0]?.id;
  if (!dsId) { console.log("ERROR: No data source ID"); return; }

  console.log("=== QUERYING PROJECTS ===");
  const response = await (notion as any).dataSources.query({ data_source_id: dsId });
  console.log(`Total projects: ${response.results.length}`);
  console.log();

  // --- Collect all phases ---
  const calendarCounts: Record<string, number> = {};
  const phaseTypeCounts: Record<string, number> = {};
  let totalPhases = 0;
  let phasesWithDates = 0;
  let phasesWithoutDates = 0;

  for (const page of response.results as any[]) {
    const projectName = page.properties["Project name"]?.title?.[0]?.plain_text || "Untitled";
    const allPhasesProp = page.properties["All Phases"];
    if (!allPhasesProp) continue;

    let phaseIds: string[] = [];
    try {
      const propResponse = await notion.pages.properties.retrieve({
        page_id: page.id,
        property_id: allPhasesProp.id,
      });
      phaseIds = ((propResponse as any).results || []).map((r: any) => r.relation.id);
    } catch (err: any) {
      console.log(`  ERROR fetching phases for ${projectName}: ${err.message}`);
      continue;
    }

    if (phaseIds.length === 0) continue;

    console.log(`${projectName} (${phaseIds.length} phases)`);

    for (const phaseId of phaseIds) {
      try {
        const phasePage = await notion.pages.retrieve({ page_id: phaseId });
        const props = (phasePage as any).properties;
        const phaseName = props.Name?.title?.[0]?.plain_text || "Untitled Phase";
        const phaseDates = props["Phase Dates"]?.date;
        const phaseType = props["Phase Type"]?.select?.name || null;
        const calId = calendarIdForPhaseType(phaseType);
        const calLabel = phaseType && CALENDAR_IDS[phaseType] ? phaseType : "default";

        totalPhases++;

        // Count by type
        const typeLabel = phaseType || "(no type)";
        phaseTypeCounts[typeLabel] = (phaseTypeCounts[typeLabel] || 0) + 1;

        // Count by calendar
        calendarCounts[calLabel] = (calendarCounts[calLabel] || 0) + 1;

        if (phaseDates?.start) {
          phasesWithDates++;
          const dateStr = `${phaseDates.start}${phaseDates.end ? ` → ${phaseDates.end}` : ""}`;
          console.log(`  → [${calLabel}] ${phaseName} | ${dateStr} | type: ${typeLabel}`);
        } else {
          phasesWithoutDates++;
          console.log(`  → [SKIP] ${phaseName} | no dates | type: ${typeLabel}`);
        }
      } catch (err: any) {
        console.log(`  → ERROR ${phaseId}: ${err.message}`);
      }
    }
  }

  console.log();
  console.log("=== SUMMARY ===");
  console.log(`Total phases: ${totalPhases}`);
  console.log(`With dates (will sync): ${phasesWithDates}`);
  console.log(`Without dates (skipped): ${phasesWithoutDates}`);
  console.log();
  console.log("By Phase Type:");
  for (const [type, count] of Object.entries(phaseTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  console.log();
  console.log("By Calendar:");
  for (const [cal, count] of Object.entries(calendarCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cal}: ${count}`);
  }
}

main().catch(console.error);
