import { getInstance } from "@/server/actions"
import { Scrapybara, ScrapybaraClient, ScrapybaraError } from "scrapybara"
import { openai, BROWSER_SYSTEM_PROMPT } from "scrapybara/openai"
import { computerTool } from "scrapybara/tools"
import { MockService } from "@/server/mock-service"
import { truncateBase64ForLogging } from "@/lib/utils"

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

const isAbortError = (error: unknown): boolean => {
  return (
    error instanceof Error && error.message === "The user aborted a request"
  )
}

export async function POST(req: Request) {
  const { instanceId, instanceType, modelName, messages } =
    (await req.json()) as {
      instanceId: string
      instanceType: string
      modelName: string
      messages: Scrapybara.Message[]
    }

  const apiKey = SCRAPYBARA_API_KEY

  const abortController = new AbortController()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Use mock service if enabled
        if (USE_MOCK && mockService) {
          for await (const message of mockService.generateMockStream(
            messages
          )) {
            if (abortController.signal.aborted) break

            if (message.role === "assistant" || message.role === "tool") {
              controller.enqueue(`${JSON.stringify(message)}\n`)
              controller.enqueue(": flush\n")
            }
          }
          controller.close()
          return
        }

        // Real Scrapybara flow
        const client = new ScrapybaraClient({ apiKey })

        const instance = await client.get(instanceId)

        const model = openai({ name: modelName })

        const tools: Scrapybara.Tool[] = [computerTool(instance)]

        await client.act({
          model,
          tools,
          system: BROWSER_SYSTEM_PROMPT,
          messages,

          onAssistantMessage: (message: Scrapybara.AssistantMessage) => {
            console.log(
              "onAssistantMessage:",
              JSON.stringify(truncateBase64ForLogging(message), null, 2)
            )
            controller.enqueue(`${JSON.stringify(message)}\n`)
            controller.enqueue(": flush\n")
          },
          onToolMessage: (message: Scrapybara.ToolMessage) => {
            console.log(
              "onToolMessage:",
              JSON.stringify(truncateBase64ForLogging(message), null, 2)
            )
            controller.enqueue(`${JSON.stringify(message)}\n`)
            controller.enqueue(": flush\n")
          },
          onStep: async () => {
            try {
              const response = await getInstance({ instanceId, instanceType })
              const parsedResponse = JSON.parse(response)
              console.log(
                "onStep:",
                JSON.stringify(
                  truncateBase64ForLogging(parsedResponse),
                  null,
                  2
                )
              )
              if (parsedResponse.status !== "running" || parsedResponse.error) {
                throw new Error("Instance has terminated")
              }
            } catch {
              abortController.abort()
            }
          },
        })
      } catch (error) {
        if (!isAbortError(error)) {
          const errorMessage =
            error instanceof Error || error instanceof ScrapybaraError
              ? error.message
              : "Unknown error"
          controller.enqueue(`${JSON.stringify({ error: errorMessage })}\n`)
          console.error(errorMessage)
        }
      } finally {
        try {
          controller.close()
        } catch {
          // Controller might already be closed, ignore the error
        }
      }
    },
  })

  return new Response(stream)
}
