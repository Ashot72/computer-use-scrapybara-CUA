"use server"

import { mkdir, writeFile, readFile, readdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import type { Scrapybara } from "scrapybara"

const DATA_DIR = join(process.cwd(), "data", "messages")

// Ensure directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

function getMessagesPath(instanceId: string) {
  return join(DATA_DIR, `${instanceId}.json`)
}

export async function saveMessages(
  messages: Scrapybara.Message[],
  instanceId: string
): Promise<void> {
  await ensureDataDir()
  const filePath = getMessagesPath(instanceId)
  await writeFile(filePath, JSON.stringify(messages, null, 2), "utf-8")
}

export async function loadMessages(
  instanceId: string
): Promise<Scrapybara.Message[]> {
  const filePath = getMessagesPath(instanceId)

  if (!existsSync(filePath)) {
    return []
  }

  const content = await readFile(filePath, "utf-8")
  return JSON.parse(content) as Scrapybara.Message[]
}

function getFirstUserMessagePreview(messages: Scrapybara.Message[]): string {
  const firstUserMessage = messages.find(msg => msg.role === "user")
  if (!firstUserMessage) return ""

  const fullText = firstUserMessage.content
    .filter(
      (part): part is { type: "text"; text: string } =>
        part.type === "text" && !!part.text
    )
    .map(part => part.text)
    .join(" ")

  return fullText.length > 40 ? `${fullText.substring(0, 40)}...` : fullText
}

export async function listChats(): Promise<
  Array<{
    id: string
    instanceId: string
    title: string | null
    preview: string
    lastMessageAt: Date | null
    messageCount: number
    createdAt: Date
    updatedAt: Date
  }>
> {
  try {
    await ensureDataDir()
    const files = await readdir(DATA_DIR)
    const jsonFiles = files.filter(f => f.endsWith(".json"))

    const chats = await Promise.all(
      jsonFiles.map(async file => {
        const instanceId = file.replace(".json", "")
        const messages = await loadMessages(instanceId)
        const lastMessage =
          messages.length > 0 ? messages[messages.length - 1] : null
        const preview = getFirstUserMessagePreview(messages)

        return {
          id: instanceId,
          instanceId,
          title: null,
          preview,
          lastMessageAt: lastMessage ? new Date() : null,
          messageCount: messages.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    )

    return chats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  } catch {
    return []
  }
}
