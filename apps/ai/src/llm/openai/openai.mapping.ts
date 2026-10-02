import type OpenAI from 'openai';
import type {
  ConversationItem,
  LlmStopReason,
  ToolCall,
  ToolDefinition,
} from '../llm.types.js';

type InputItem = OpenAI.Responses.ResponseInputItem;
type OutputItem = OpenAI.Responses.ResponseOutputItem;
type Response = OpenAI.Responses.Response;
type FunctionTool = OpenAI.Responses.FunctionTool;

/** The output items sent back as input within one answer. */
type EchoedItem =
  | OpenAI.Responses.ResponseOutputMessage
  | OpenAI.Responses.ResponseFunctionToolCall
  | OpenAI.Responses.ResponseReasoningItem;

// Pure translations between the provider-neutral conversation and the OpenAI
// Responses API.

export function toInputItems(
  conversation: readonly ConversationItem[],
): InputItem[] {
  return conversation.flatMap((item): InputItem[] => {
    switch (item.role) {
      case 'user':
        return [{ role: 'user', content: item.text }];
      case 'assistant':
        return item.providerContent
          ? (item.providerContent as InputItem[])
          : [{ role: 'assistant', content: item.text }];
      case 'tool_results':
        // The API has no error flag on tool output: say it in the text.
        return item.results.map((result) => ({
          type: 'function_call_output',
          call_id: result.toolCallId,
          output: result.isError ? `Error: ${result.content}` : result.content,
        }));
    }
  });
}

export function toFunctionTool(definition: ToolDefinition): FunctionTool {
  // `$schema` is metadata the API doesn't need.
  const { $schema: _ignored, ...parameters } = definition.inputSchema;
  void _ignored;
  return {
    type: 'function',
    name: definition.name,
    description: definition.description,
    parameters,
    // Strict mode requires every property to be required; the MCP tools have
    // optional inputs, and the MCP server validates them anyway.
    strict: false,
  };
}

function isEchoed(item: OutputItem): item is EchoedItem {
  return (
    item.type === 'message' ||
    item.type === 'function_call' ||
    item.type === 'reasoning'
  );
}

/**
 * The output to send back on the next request of the same answer: messages,
 * function calls and reasoning items (with their encrypted content, since the
 * conversation is not stored at OpenAI).
 */
export function echoableItems(output: readonly OutputItem[]): EchoedItem[] {
  return output.filter(isEchoed);
}

export function toolCallsOf(output: readonly OutputItem[]): ToolCall[] {
  return output.flatMap((item) =>
    item.type === 'function_call'
      ? [
          {
            id: item.call_id,
            name: item.name,
            input: parseArguments(item.arguments),
          },
        ]
      : [],
  );
}

export function textOf(output: readonly OutputItem[]): string {
  return output
    .flatMap((item) =>
      item.type === 'message'
        ? item.content.flatMap((part) =>
            part.type === 'output_text' ? [part.text] : [],
          )
        : [],
    )
    .join('');
}

export function toStopReason(response: Response): LlmStopReason {
  if (response.status === 'incomplete') {
    return response.incomplete_details?.reason === 'content_filter'
      ? 'refusal'
      : 'max_tokens';
  }
  const refused = response.output.some(
    (item) =>
      item.type === 'message' &&
      item.content.some((part) => part.type === 'refusal'),
  );
  if (refused) return 'refusal';
  if (response.output.some((item) => item.type === 'function_call')) {
    return 'tool_use';
  }
  return 'end';
}

/** Tool arguments arrive as JSON text; anything unusable becomes `{}` (the MCP server rejects it). */
function parseArguments(json: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
