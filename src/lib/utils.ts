import type { Scrapybara } from "scrapybara"

// Filters images from messages, keeping only the most recent N images.
// Removes base64Image from older tool results to reduce payload size.
export function filterImages(
  messages: Scrapybara.Message[],
  imagesToKeep: number
): Scrapybara.Message[] {
  const messagesCopy = JSON.parse(
    JSON.stringify(messages)
  ) as Scrapybara.Message[]

  let imagesKept = 0

  for (let i = messagesCopy.length - 1; i >= 0; i--) {
    const msg = messagesCopy[i]

    if (!msg) continue
    if (msg.role === "tool" && Array.isArray(msg.content)) {
      for (let j = msg.content.length - 1; j >= 0; j--) {
        const toolResult = msg.content[j]
        if (
          toolResult?.result &&
          (toolResult.result as { base64Image?: string }).base64Image
        ) {
          if (imagesKept < imagesToKeep) {
            imagesKept++
          } else {
            delete (toolResult.result as { base64Image?: string }).base64Image
          }
        }
      }
    }
  }

  return messagesCopy
}

// Helper function to truncate base64 images in objects for console logging
export function truncateBase64ForLogging(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === "string") {
    // If it's a very long string that looks like base64, truncate it
    if (obj.length > 200 && /^[A-Za-z0-9+/=]+$/.test(obj)) {
      return obj.substring(0, 200) + "... [truncated]"
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => truncateBase64ForLogging(item))
  }

  if (typeof obj === "object") {
    const truncated: any = {}
    for (const key in obj) {
      if (key === "base64Image" && typeof obj[key] === "string") {
        truncated[key] = obj[key].substring(0, 200) + "... [truncated]"
      } else {
        truncated[key] = truncateBase64ForLogging(obj[key])
      }
    }
    return truncated
  }

  return obj
}
