import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export interface NotionPhase {
  title: string;       // e.g. "P1: Exhibition Identity"
  projectName: string; // e.g. "CPR02: Improper Frames"
  start: string;
  end: string | null;
  phaseType: string | null;
}

async function getDataSourceId(): Promise<string> {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const dataSources = (db as any).data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error("No data sources found on database");
  }
  return dataSources[0].id;
}

async function getPhaseIds(pageId: string, propertyId: string): Promise<string[]> {
  const response = await notion.pages.properties.retrieve({
    page_id: pageId,
    property_id: propertyId,
  });
  const results = (response as any).results || [];
  return results.map((r: any) => r.relation.id);
}

async function getPhaseDetails(
  phaseId: string,
  projectName: string
): Promise<NotionPhase | null> {
  const page = await notion.pages.retrieve({ page_id: phaseId });
  const props = (page as any).properties;

  const title =
    props.Name?.title?.[0]?.plain_text || "Untitled Phase";
  const start = props["Phase Dates"]?.date?.start || null;
  const end = props["Phase Dates"]?.date?.end || null;
  const phaseType = props["Phase Type"]?.select?.name || null;

  if (!start) return null;

  return { title, projectName, start, end, phaseType };
}

export async function getNotionPhases(): Promise<NotionPhase[]> {
  const dataSourceId = await getDataSourceId();
  const response = await (notion as any).dataSources.query({
    data_source_id: dataSourceId,
  });

  const phases: NotionPhase[] = [];

  for (const page of response.results as any[]) {
    const projectName =
      page.properties["Project name"]?.title?.[0]?.plain_text || "Untitled";
    const allPhasesProperty = page.properties["All Phases"];
    if (!allPhasesProperty) continue;

    const phaseIds = await getPhaseIds(page.id, allPhasesProperty.id);

    for (const phaseId of phaseIds) {
      try {
        const phase = await getPhaseDetails(phaseId, projectName);
        if (phase) phases.push(phase);
      } catch (err: any) {
        console.error(`Error fetching phase ${phaseId}: ${err.message}`);
      }
    }
  }

  return phases;
}
