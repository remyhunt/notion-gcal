import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export interface NotionEvent {
  title: string;
  start: string; // ISO string
  end: string | null;
}

async function getDataSourceId(): Promise<string> {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const dataSources = (db as any).data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error("No data sources found on database");
  }
  return dataSources[0].data_source_id;
}

export async function getNotionEvents(): Promise<NotionEvent[]> {
  const dataSourceId = await getDataSourceId();
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
  });

  return response.results.map((page: any) => {
    const props = page.properties;
    return {
      title: props["Project name"]?.title?.[0]?.plain_text || "Untitled",
      start: props.Dates?.date?.start || null,
      end: props.Dates?.date?.end || null,
    };
  }).filter((e: NotionEvent) => e.start !== null);
}
