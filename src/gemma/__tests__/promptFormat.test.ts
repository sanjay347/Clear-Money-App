import { finishCompletion, formatChat, formatPrompt, stripStopTokens } from '../promptFormat';

describe('formatPrompt', () => {
  it('legacy: folds the system prompt into the user turn', () => {
    expect(formatPrompt({ system: 'S', user: 'U', prefill: '[' }, 'legacy'))
      .toBe('<start_of_turn>user\nS\n\nU<end_of_turn>\n<start_of_turn>model\n[');
  });
  it('gemma4: uses a system turn and the model\'s own turn markers', () => {
    expect(formatPrompt({ system: 'S', user: 'U', prefill: '[' }, 'gemma4'))
      .toBe('<|turn>system\nS<turn|>\n<|turn>user\nU<turn|>\n<|turn>model\n[');
  });
  it('omits the system part when there is none', () => {
    expect(formatPrompt({ user: 'U' }, 'gemma4')).toBe('<|turn>user\nU<turn|>\n<|turn>model\n');
    expect(formatPrompt({ user: 'U' }, 'legacy')).toBe('<start_of_turn>user\nU<end_of_turn>\n<start_of_turn>model\n');
  });
  it('never adds <bos>', () => {
    expect(formatPrompt({ system: 'S', user: 'U' }, 'legacy')).not.toContain('<bos>');
    expect(formatPrompt({ system: 'S', user: 'U' }, 'gemma4')).not.toContain('<bos>');
  });
});

describe('formatChat', () => {
  it('renames assistant to model in both formats', () => {
    const messages = [{ role: 'user' as const, content: 'U' }, { role: 'assistant' as const, content: 'A' }];
    expect(formatChat(messages, 'legacy')).toBe('<start_of_turn>user\nU<end_of_turn>\n<start_of_turn>model\nA<end_of_turn>\n<start_of_turn>model\n');
    expect(formatChat(messages, 'gemma4')).toBe('<|turn>user\nU<turn|>\n<|turn>model\nA<turn|>\n<|turn>model\n');
  });
});

describe('finishCompletion', () => {
  it('cuts at a stop token from either format', () => {
    expect(stripStopTokens('answer<end_of_turn>junk')).toBe('answer');
    expect(stripStopTokens('answer<turn|>junk')).toBe('answer');
  });
  it('re-attaches the prefill', () => {
    expect(finishCompletion('{"a":1}]', '[')).toBe('[{"a":1}]');
  });
  it('does not double a prefill the runtime already echoed', () => {
    expect(finishCompletion('[{"a":1}]', '[')).toBe('[{"a":1}]');
  });
});
