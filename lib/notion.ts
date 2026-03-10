import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID!;

export interface NotionEvent {
  pageId: string;
  title: string;
  start: string; // ISO string
  end: string | null;
  googleEventId: string | null;
  lastSynced: string | null;
}

export async function getNotionEvents(): Promise<NotionEvent[]> {
  const response = await notion.databases.query({
    database_id: databaseId,
  });

  return response.results.map((page: any) => {
    const props = page.properties;
    return {
      pageId: page.id,
      title: props.Name?.title?.[0]?.plain_text || "Untitled",
      start: props.Date?.date?.start || null,
      end: props.Date?.date?.end || null,
      googleEventId: props["Google Event ID"]?.rich_text?.[0]?.plain_text || null,
      lastSynced: props["Last Synced"]?.date?.start || null,
    };
  }).filter((e: NotionEvent) => e.start !== null);
}

export async function createNotionEvent(
  title: string,
  start: string,
  end: string | null,
  googleEventId: string
): Promise<string> {
  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: title } }] },
      Date: { date: { start, end: end || undefined } },
      "Google Event ID": { rich_text: [{ text: { content: googleEventId } }] },
      "Last Synced": { date: { start: new Date().toISOString() } },
    },
  });
  return response.id;
}

export async function updateNotionEvent(
  pageId: string,
  updates: { title?: string; start?: string; end?: string | null; googleEventId?: string }
): Promise<void> {
  const properties: any = {
    "Last Synced": { date: { start: new Date().toISOString() } },
  };

  if (updates.title !== undefined) {
    properties.Name = { title: [{ text: { content: updates.title } }] };
  }
  if (updates.start !== undefined) {
    properties.Date = { date: { start: updates.start, end: updates.end || undefined } };
  }
  if (updates.googleEventId !== undefined) {
    properties["Google Event ID"] = {
      rich_text: [{ text: { content: updates.googleEventId } }],
    };
  }

  await notion.pages.update({ page_id: pageId, properties });
}

export async function deleteNotionEvent(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}
