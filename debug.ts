import "dotenv/config";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function main() {
  const db = await notion.databases.retrieve({
    database_id: process.env.NOTION_DATABASE_ID!,
  });
  console.log(JSON.stringify(db, null, 2));
}

main().catch(console.error);
