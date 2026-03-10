import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export interface NotionEvent {
  title: string;
  start: string; // ISO string
  end: string | null;
}

export async function getNotionEvents(): Promise<NotionEvent[]> {
  const response = await notion.dataSources.query({
    data_source_id: databaseId,
  });

  return response.results.map((page: any) => {
    const props = page.properties;
    return {
      title: props.Name?.title?.[0]?.plain_text || "Untitled",
      start: props.Date?.date?.start || null,
      end: props.Date?.date?.end || null,
    };
  }).filter((e: NotionEvent) => e.start !== null);
}
