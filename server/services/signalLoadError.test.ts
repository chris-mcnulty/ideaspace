import { describe, expect, it } from 'vitest';
import { signalLoadErrorMessage } from '../../client/src/components/signal/loadError';

describe('Signal participant load failures', () => {
  it.each(['GUEST_ACCESS_DISABLED', 'GUEST_ACCESS_REVOKED'])(
    'explains %s instead of saying the question has not started',
    code => {
      const error = new Error(`403: ${JSON.stringify({ error: 'Forbidden', code })}`);
      expect(signalLoadErrorMessage(error)).toContain('Guest access is disabled');
    },
  );
  it('explains an expired or different-workspace participant session', () => {
    expect(signalLoadErrorMessage(new Error('403: {"code":"NO_ACCESS"}')))
      .toContain('Rejoin the workspace');
  });
  it('explains a closed workspace', () => {
    expect(signalLoadErrorMessage(new Error('403: {"code":"WORKSPACE_CLOSED"}')))
      .toContain('workspace is closed');
  });
  it.each([new Error('Failed to fetch'), new Error('500: {broken'), undefined])(
    'gives a safe retry message for an unrecognized failure',
    error => {
      expect(signalLoadErrorMessage(error)).toContain('Check your connection and try again');
    },
  );
});
