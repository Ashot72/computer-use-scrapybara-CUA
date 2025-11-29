import type { Scrapybara } from "scrapybara"
import {
  SCREENSHOT_1_INITIAL,
  SCREENSHOT_2_AFTER_CLICK,
  SCREENSHOT_3_AFTER_TYPE,
  SCREENSHOT_4_AFTER_RETURN,
  SCREENSHOT_5_AFTER_WAIT,
} from "./mock-screenshots"

interface MockConfig {
  enabled: boolean
  delayMs?: number
  fakeInstanceId?: string
}

export class MockService {
  private config: MockConfig

  constructor(config: MockConfig) {
    this.config = config
  }

  private async delay(ms: number = 500) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isNavigateToAmazon(userMessage: string): boolean {
    const lower = userMessage.toLowerCase()
    return (
      (lower.includes("navigate") ||
        lower.includes("go to") ||
        lower.includes("open")) &&
      lower.includes("amazon")
    )
  }

  private generateNavigateAmazonSteps(): Array<{
    assistant?: Scrapybara.AssistantMessage
    tool?: Scrapybara.ToolMessage
  }> {
    return [
      // Step 1: Take screenshot
      {
        assistant: {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_take_screenshot",
              toolName: "computer",
              args: {
                action: "take_screenshot",
              },
            },
          ],
        },
        tool: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_take_screenshot",
              toolName: "computer",
              result: {
                base64Image: SCREENSHOT_1_INITIAL,
                error: "",
                output: "",
              },
            },
          ],
        },
      },
      // Step 2: Click mouse at address bar
      {
        assistant: {
          role: "assistant",
          content: [
            {
              type: "reasoning",
              id: "rs_reasoning_1",
              instructions: undefined,
              reasoning: "",
              signature: undefined,
            },
            {
              type: "tool-call",
              toolCallId: "call_click_mouse",
              toolName: "computer",
              args: {
                action: "click_mouse",
                button: "left",
                click_type: "click",
                coordinates: [253, 58],
                num_clicks: 1,
              },
            },
          ],
        },
        tool: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_click_mouse",
              toolName: "computer",
              result: {
                base64Image: SCREENSHOT_2_AFTER_CLICK,
                error: "",
                output: "",
              },
            },
          ],
        },
      },
      // Step 3: Type URL
      {
        assistant: {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_type_text",
              toolName: "computer",
              args: {
                action: "type_text",
                text: "www.amazon.com",
              },
            },
          ],
        },
        tool: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_type_text",
              toolName: "computer",
              result: {
                base64Image: SCREENSHOT_3_AFTER_TYPE,
                error: "",
                output: "",
              },
            },
          ],
        },
      },
      // Step 4: Press Return key
      {
        assistant: {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_press_key",
              toolName: "computer",
              args: {
                action: "press_key",
                keys: ["Return"],
              },
            },
          ],
        },
        tool: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_press_key",
              toolName: "computer",
              result: {
                base64Image: SCREENSHOT_4_AFTER_RETURN,
                error: "",
                output: "",
              },
            },
          ],
        },
      },
      // Step 5: Wait for page load
      {
        assistant: {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_wait",
              toolName: "computer",
              args: {
                action: "wait",
                duration: 1,
              },
            },
          ],
        },
        tool: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_wait",
              toolName: "computer",
              result: {
                base64Image: SCREENSHOT_5_AFTER_WAIT,
                error: "",
                output: "",
              },
            },
          ],
        },
      },
      // Step 6: Final response
      {
        assistant: {
          role: "assistant",
          content: [
            {
              type: "reasoning",
              id: "rs_reasoning_final",
              instructions: undefined,
              reasoning: "",
              signature: undefined,
            },
            {
              type: "text",
              text: "I've navigated to Amazon's homepage. Would you like to search for a specific item or explore any particular section?",
            },
          ],
        },
      },
    ]
  }

  async *generateMockStream(
    messages: Scrapybara.Message[]
  ): AsyncGenerator<Scrapybara.Message, void, unknown> {
    const lastUserMessage = messages.filter(m => m.role === "user").pop()

    if (!lastUserMessage || !lastUserMessage.content) {
      return
    }

    const userText = lastUserMessage.content
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map(part => part.text)
      .join("")
      .trim()

    if (!userText || !this.isNavigateToAmazon(userText)) {
      return
    }

    const steps = this.generateNavigateAmazonSteps()

    // Yield each step with delays to simulate real streaming
    const delayMs = this.config.delayMs || 500
    for (const step of steps) {
      if (step.assistant) {
        await this.delay(delayMs)
        yield step.assistant
      }

      if (step.tool) {
        await this.delay(delayMs)
        yield step.tool
      }
    }
  }

  getFakeInstanceId(): string {
    return this.config.fakeInstanceId || "mock-instance-12345"
  }
}
