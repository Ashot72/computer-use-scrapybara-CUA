"use server"

import { BrowserInstance, ScrapybaraClient } from "scrapybara"
import { MockService } from "./mock-service"

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"
const SCRAPYBARA_API_KEY = process.env.SCRAPYBARA_API_KEY || ""
const MOCK_DELAY_MS = parseInt(process.env.MOCK_DELAY_MS || "500", 10)

const mockService = USE_MOCK
  ? new MockService({
      enabled: true,
      delayMs: MOCK_DELAY_MS,
      fakeInstanceId: process.env.NEXT_PUBLIC_MOCK_INSTANCE_ID,
    })
  : null

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Unknown error"
}

export async function startInstance({ authStateId }: { authStateId?: string }) {
  try {
    if (USE_MOCK && mockService) {
      return JSON.stringify({
        instanceId: mockService.getFakeInstanceId(),
        streamUrl: "mock", // Not used in mock mode - screenshot is displayed instead
      })
    }

    const client = new ScrapybaraClient({
      apiKey: SCRAPYBARA_API_KEY,
    })

    let instance: BrowserInstance = await client.startBrowser()
    if (authStateId) {
      await instance.authenticate({ authStateId })
    }

    return JSON.stringify({
      instanceId: instance.id,
      streamUrl: (await instance.getStreamUrl()).streamUrl,
    })
  } catch (error) {
    return JSON.stringify({
      error: getErrorMessage(error) || "Unknown error starting instance",
    })
  }
}

export async function stopInstance({ instanceId }: { instanceId: string }) {
  try {
    if (USE_MOCK && mockService) {
      return JSON.stringify({ success: true })
    }

    const client = new ScrapybaraClient({ apiKey: SCRAPYBARA_API_KEY })

    const instance = await client.get(instanceId)

    await instance.stop()

    return JSON.stringify({ success: true })
  } catch (error) {
    return JSON.stringify({
      error: getErrorMessage(error) || "Unknown error stopping instance",
    })
  }
}

export async function getInstance({
  instanceId,
  instanceType,
}: {
  instanceId: string
  instanceType: string
}) {
  try {
    if (USE_MOCK && mockService) {
      return JSON.stringify({
        id: mockService.getFakeInstanceId(),
        status: "stopped",
        type: instanceType,
      })
    }

    const client = new ScrapybaraClient({ apiKey: SCRAPYBARA_API_KEY })
    const instance = await client.get(instanceId)

    return JSON.stringify(instance)
  } catch (error) {
    return JSON.stringify({
      error: getErrorMessage(error) || "Unknown error getting instance",
    })
  }
}
