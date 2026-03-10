import "dotenv/config";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function main() {
  // Fetch first phase page from CPR02
  const phasePage = await notion.pages.retrieve({
    page_id: "2b768770-b51e-8054-8103-c622a649c34a",
  });

  const props = (phasePage as any).properties;
  for (const [key, val] of Object.entries(props as Record<string, any>)) {
    console.log(`${key} (${(val as any).type}): ${JSON.stringify(val).slice(0, 300)}`);
  }
}

main().catch(console.error);
