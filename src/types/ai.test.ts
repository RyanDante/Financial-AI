import { AGENT_ROUTING_TOOL_NAME, extractAgentName, makeAgentRoutingRecord, visibleToolCalls } from './ai';
import type { ToolCallRecord } from './ai';

describe('makeAgentRoutingRecord / extractAgentName', () => {
  it('round-trips the agent name through a ToolCallRecord', () => {
    const record = makeAgentRoutingRecord('Spending Agent');
    expect(record.toolName).toBe(AGENT_ROUTING_TOOL_NAME);
    expect(extractAgentName([record])).toBe('Spending Agent');
  });

  it('returns null when there is no routing marker', () => {
    const real: ToolCallRecord = { toolName: 'getSpending', input: {}, output: {} };
    expect(extractAgentName([real])).toBeNull();
    expect(extractAgentName(null)).toBeNull();
    expect(extractAgentName(undefined)).toBeNull();
  });

  it('finds the marker alongside real tool calls', () => {
    const real: ToolCallRecord = { toolName: 'getSpending', input: {}, output: {} };
    expect(extractAgentName([makeAgentRoutingRecord('Budget Agent'), real])).toBe('Budget Agent');
  });
});

describe('visibleToolCalls', () => {
  it('filters out the routing marker but keeps real tool calls', () => {
    const real: ToolCallRecord = { toolName: 'getSpending', input: {}, output: {} };
    const filtered = visibleToolCalls([makeAgentRoutingRecord('Spending Agent'), real]);
    expect(filtered).toEqual([real]);
  });

  it('returns an empty array for null/undefined/empty input', () => {
    expect(visibleToolCalls(null)).toEqual([]);
    expect(visibleToolCalls(undefined)).toEqual([]);
    expect(visibleToolCalls([])).toEqual([]);
  });
});
