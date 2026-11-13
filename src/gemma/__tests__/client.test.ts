import { buildGemma4Prompt, enqueue } from '../client';

jest.mock('../downloadManager', () => ({ MODEL_PATH: 'file:///model.gguf' }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));

describe('enqueue', () => {
  it('runs completions one at a time, in order', async () => {
    const log: string[] = [];
    const job = (name: string, ms: number) => () =>
      new Promise<string>(resolve => {
        log.push(`start ${name}`);
        setTimeout(() => { log.push(`end ${name}`); resolve(name); }, ms);
      });
    const results = await Promise.all([enqueue(job('a', 30)), enqueue(job('b', 5)), enqueue(job('c', 1))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('keeps running after a job fails', async () => {
    await expect(enqueue(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(enqueue(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});

describe('buildGemma4Prompt', () => {
  it('names the assistant role "model" and ends with an open model turn', () => {
    const prompt = buildGemma4Prompt([
      { role: 'system', content: 'S' },
      { role: 'user', content: 'U' },
      { role: 'assistant', content: 'A' },
      { role: 'user', content: 'U2' },
    ]);
    expect(prompt).toContain('<start_of_turn>model\nA<end_of_turn>');
    expect(prompt).not.toContain('assistant');
    expect(prompt.endsWith('<start_of_turn>model\n')).toBe(true);
    expect(prompt).not.toContain('<bos>');
  });
});
