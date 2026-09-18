import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWisdoKnowledgeIntent, extractCourseSeed, isExplicitGuardModeRequest, isExplicitMt4Mutation } from '../services/wisdoDiscordIntentGuard.js';

test('course creation outranks the word trading and cannot execute', () => {
  const result = classifyWisdoKnowledgeIntent('Hey coach let’s build a trading course');
  assert.equal(result.intent, 'course_forge');
  assert.equal(result.executionAllowed, false);
  assert.equal(isExplicitMt4Mutation('Hey coach let’s build a trading course', 'mt4_guard_mode'), false);
});

test('learning, promotion, and screen-guide requests stay non-executable', () => {
  for (const phrase of [
    'teach me trading risk',
    'brainstorm a promotion for my trading class',
    'document my screen share as a trading procedure',
    'let us discuss protecting a trading account',
  ]) {
    assert.ok(classifyWisdoKnowledgeIntent(phrase), phrase);
    assert.equal(isExplicitMt4Mutation(phrase, 'mt4_guard_mode'), false, phrase);
  }
});

test('real Guard Mode requests remain explicit', () => {
  for (const phrase of ['put my account in guard mode', 'protect my account', 'activate safe mode', 'stop new trades']) {
    assert.equal(isExplicitGuardModeRequest(phrase), true, phrase);
    assert.equal(isExplicitMt4Mutation(phrase, 'mt4_guard_mode'), true, phrase);
  }
});

test('course seed extracts a useful topic', () => {
  const seed = extractCourseSeed('Hey coach let’s build a trading psychology course');
  assert.equal(seed.topic, 'trading psychology');
  assert.equal(seed.title, 'Trading Psychology Course');
});
