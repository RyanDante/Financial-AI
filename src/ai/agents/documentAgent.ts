import type { AgentDefinition } from './types';

/**
 * NOT IMPLEMENTED — interface only, per this phase's brief (section 25:
 * "prepare interfaces... do not fully implement unless explicitly
 * requested"). `supportedIntents` is empty because the current intent
 * taxonomy (AgentIntent) has no "document" entry, so the Orchestrator can
 * never route here. Future scope: reading file_uploads rows and running
 * OCR/extraction on an attached receipt — see docs/FIREBASE.md "Storage"
 * for the extension point this would use.
 */
export const documentAgent: AgentDefinition = {
  id: 'document',
  name: 'Document Agent',
  description: 'Not yet implemented — will process attached receipts/documents (OCR, data extraction) in a future phase.',
  supportedIntents: [],
  allowedTools: [],
  async execute() {
    throw new Error('Document Agent is not implemented yet.');
  },
};
