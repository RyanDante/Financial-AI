import { goalAgent } from './goalAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string, entities: Record<string, unknown> = {}): AgentRequest {
  return { text, intent: 'goal', entities };
}

function fakeTools(responses: Record<string, unknown>): ToolExecutor {
  return { execute: jest.fn(async (name: string) => responses[name]) };
}

const laptopGoal = {
  goal: {
    id: 'goal-laptop',
    name: 'Laptop',
    targetAmountMinor: 900000,
    currentAmountMinor: 250000,
    currency: 'XAF',
    deadline: '2027-03-01T00:00:00.000Z',
  },
  progress: { percent: (250000 / 900000) * 100, remainingMinor: 650000, daysRemaining: 90, isOverdue: false, isComplete: false },
  requiredMonthlySavingsMinor: 219845,
};

describe('goalAgent — progress', () => {
  it('reports progress and the required monthly pace for a single goal', async () => {
    const tools = fakeTools({ getGoals: [laptopGoal] });

    const response = await goalAgent.execute(request('How close am I to my goal?'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getGoals', {});
    expect(response.message).toContain('Laptop');
    expect(response.message).toContain('28%'); // 250000/900000 ≈ 27.8 -> toFixed(0) = 28
    expect(response.message).toContain('219,845 FCFA');
  });

  it('picks out a goal named in the question when more than one exists', async () => {
    const vacationGoal = { ...laptopGoal, goal: { ...laptopGoal.goal, id: 'goal-vacation', name: 'Vacation' } };
    const tools = fakeTools({ getGoals: [laptopGoal, vacationGoal] });

    const response = await goalAgent.execute(request('How much do I need to save for my laptop?'), context, tools);

    expect(response.message).toContain('Laptop');
    expect(response.message).not.toContain('Vacation');
  });

  it('summarizes every goal when several exist and none is named', async () => {
    const vacationGoal = { ...laptopGoal, goal: { ...laptopGoal.goal, id: 'goal-vacation', name: 'Vacation' } };
    const tools = fakeTools({ getGoals: [laptopGoal, vacationGoal] });

    const response = await goalAgent.execute(request('How are my goals doing?'), context, tools);

    expect(response.message).toContain('Laptop');
    expect(response.message).toContain('Vacation');
  });

  it('reports a completed goal as complete rather than computing a pace for it', async () => {
    const completedGoal = {
      ...laptopGoal,
      progress: { ...laptopGoal.progress, percent: 100, remainingMinor: 0, isComplete: true },
      requiredMonthlySavingsMinor: null,
    };
    const tools = fakeTools({ getGoals: [completedGoal] });

    const response = await goalAgent.execute(request('How close am I to my laptop goal?'), context, tools);

    expect(response.message).toContain('already complete');
  });
});

describe('goalAgent — projection', () => {
  it('calls calculateGoalProjection with the hypothetical amount and reports the projected date', async () => {
    const tools = fakeTools({
      getGoals: [laptopGoal],
      calculateGoalProjection: {
        goal: laptopGoal.goal,
        monthlyContributionMinor: 300000,
        projectedCompletionDate: new Date('2026-04-01T00:00:00.000Z'),
      },
    });

    const response = await goalAgent.execute(request('What happens if I save 300000 a month?', { amountMajor: 300000 }), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('calculateGoalProjection', { goalId: 'goal-laptop', monthlyContributionMinor: 300000 });
    expect(response.message).toContain('300,000 FCFA/month');
    expect(response.claims.some((c) => c.kind === 'projection')).toBe(true);
    expect(response.claims.some((c) => c.kind === 'assumption')).toBe(true);
  });

  it('reports plainly when the hypothetical contribution would never reach the goal', async () => {
    const tools = fakeTools({
      getGoals: [laptopGoal],
      calculateGoalProjection: { goal: laptopGoal.goal, monthlyContributionMinor: 0, projectedCompletionDate: null },
    });

    const response = await goalAgent.execute(request('What if I saved 0 a month?', { amountMajor: 0 }), context, tools);

    // amountMajor: 0 is falsy-but-defined; the agent should still attempt the projection since 0 !== undefined.
    expect(tools.execute).toHaveBeenCalledWith('calculateGoalProjection', expect.anything());
    expect(response.message).toContain('would never reach this goal');
  });
});

describe('goalAgent — missing goal', () => {
  it('reports no goals rather than fabricating progress', async () => {
    const tools = fakeTools({ getGoals: [] });

    const response = await goalAgent.execute(request('How close am I to my goal?'), context, tools);

    expect(response.message).toBe('FACT: You have no goals set up yet.\nWant to create one?');
  });
});

describe('goalAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating an answer', async () => {
    const tools: ToolExecutor = { execute: async () => { throw new Error('goals repository unavailable'); } };

    await expect(goalAgent.execute(request('How close am I to my goal?'), context, tools)).rejects.toThrow('goals repository unavailable');
  });
});
