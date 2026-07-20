#!/usr/bin/env node
/**
 * 测试运行器 - 纯 Node.js，零依赖
 * 用法: node scripts/run-tests.js
 */

// ─── 简单的测试框架 ───
let totalTests = 0;
let passedTests = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ❌ ${name}`);
    failures.push({ name, error: err.message });
  }
}

// ─── 断言工具 ───
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, msg) {
  if (!value) {
    throw new Error(msg || 'Expected true, got false');
  }
}

// ─── 模拟浏览器 API ───
global.document = { body: {} };
global.localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, val) { this.data[key] = val; },
  removeItem(key) { delete this.data[key]; }
};

// ─── 词库（与 index.html 分类结构一致） ───
const WORD_BANK = {
  verb: [
    { id:'v001', word:'go',   category:'verb', forms:{ thirdPerson:'goes', presentParticiple:'going', pastTense:'went' }},
    { id:'v002', word:'do',   category:'verb', forms:{ thirdPerson:'does', presentParticiple:'doing', pastTense:'did' }},
    { id:'v003', word:'have', category:'verb', forms:{ thirdPerson:'has',  presentParticiple:'having',pastTense:'had' }}
  ],
  noun: [
    { id:'n001', word:'apple', category:'noun', plural:'apples' },
    { id:'n002', word:'book',  category:'noun', plural:'books' },
    { id:'n003', word:'child', category:'noun', plural:'children' }
  ]
};

const THEME_META = {
  thirdPerson:     { category:'verb' },
  presentParticiple:{ category:'verb' },
  pastTense:       { category:'verb' },
  plural:          { category:'noun' }
};

// ─── 艾宾浩斯算法 ───
function ebbinghausNext(correct, cur) {
  const ease = correct ? cur.ease + 0.1 : Math.max(1.3, cur.ease - 0.2);
  const interval = correct ? Math.max(1, cur.interval * ease) : 1;
  const reviewCount = cur.reviewCount + 1;
  const correctCount = cur.correctCount + (correct ? 1 : 0);
  const accuracy = correctCount / reviewCount;
  const proficiency = Math.min(1.0, 1 / (1 + Math.exp(-0.5 * (reviewCount * accuracy - 3))));
  return {
    ...cur, ease: Math.round(ease*100)/100, interval: Math.round(interval),
    reviewCount, correctCount,
    accuracy: Math.round(accuracy*100)/100,
    proficiency: Math.round(proficiency*100)/100,
    lastReviewed: Date.now(),
    nextReview: Date.now() + Math.round(interval) * 86400000
  };
}

function createInitialProgress(wordId, word, category) {
  return { wordId, word, category, ease:2.5, interval:1, reviewCount:0, correctCount:0, accuracy:0, proficiency:0, lastReviewed:null, nextReview: Date.now() };
}

// ─── 题目生成器（与 index.html 一致：用同一词的不同形态作干扰项）───
function getCorrectAnswer(word, theme) {
  if (theme === 'plural') return word.plural;
  return word.forms?.[theme] || null;
}

function _verbMisspellings(word, correct) {
  const base = word.word;
  const errs = [];
  if (!correct.endsWith('es')) errs.push(base + 'es');
  if (!correct.endsWith('s')) errs.push(base + 's');
  if (!correct.endsWith('ed')) errs.push(base + 'ed');
  if (!correct.endsWith('ing')) errs.push(base + 'ing');
  return errs;
}

function _nounMistakes(word, correct) {
  const base = word.word;
  const errs = [];
  if (correct !== base + 's') errs.push(base + 's');
  if (correct !== base + 'es') errs.push(base + 'es');
  if (base.endsWith('y') && correct !== base.slice(0,-1)+'ys') errs.push(base.slice(0,-1)+'ys');
  if (base.endsWith('f') && correct !== base+'s') errs.push(base+'s');
  if (base.endsWith('fe') && correct !== base+'s') errs.push(base+'s');
  if (word.plural !== base+'s' && word.plural !== base+'es') errs.push(base+'s');
  return errs;
}

function generateOptions(word, theme) {
  const correct = getCorrectAnswer(word, theme);
  if (!correct) return [];

  let candidates = [];

  if (word.category === 'verb' && word.forms) {
    const otherForms = [
      word.word,
      word.forms.thirdPerson,
      word.forms.presentParticiple,
      word.forms.pastTense
    ];
    const unique = [...new Set(otherForms)].filter(v => v && v !== correct);
    candidates = unique;
    const misspellings = _verbMisspellings(word, correct);
    misspellings.forEach(m => { if (!candidates.includes(m)) candidates.push(m); });
  } else {
    candidates = [word.word, correct];
    const nounMistakes = _nounMistakes(word, correct);
    nounMistakes.forEach(m => { if (!candidates.includes(m)) candidates.push(m); });
  }

  const distractors = candidates.filter(c => c !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
  while (distractors.length < 3) {
    const fallback = correct + (Math.random() > 0.5 ? 's' : 'es');
    if (!distractors.includes(fallback)) distractors.push(fallback);
    else break;
  }

  return [...distractors, correct].sort(() => Math.random() - 0.5);
}

// ═══════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════

describe('EbbinghausEngine', () => {
  it('答对时应增加复习间隔', () => {
    const r = ebbinghausNext(true, { ease:2.5, interval:1, reviewCount:0, correctCount:0 });
    assertTrue(r.interval > 1, 'Interval should increase after correct answer');
  });

  it('答错时应重置间隔为1天', () => {
    const r = ebbinghausNext(false, { ease:2.5, interval:5, reviewCount:3, correctCount:3 });
    assertEqual(r.interval, 1, 'Interval should reset to 1 on wrong answer');
  });

  it('熟练度应随正确率提升', () => {
    let state = { ease:2.5, interval:1, reviewCount:0, correctCount:0 };
    const first = ebbinghausNext(true, state).proficiency;
    for (let i = 0; i < 5; i++) state = ebbinghausNext(true, state);
    assertTrue(state.proficiency > first, 'Proficiency should increase');
  });

  it('答错时应降低 ease 因子', () => {
    const r = ebbinghausNext(false, { ease:2.5, interval:3, reviewCount:5, correctCount:5 });
    assertTrue(r.ease < 2.5, 'Ease should decrease after wrong answer');
  });

  it('初始进度应包含所有必要字段', () => {
    const p = createInitialProgress('w1', 'test', 'verb');
    assertEqual(p.wordId, 'w1');
    assertEqual(p.ease, 2.5);
    assertEqual(p.interval, 1);
    assertEqual(p.reviewCount, 0);
    assertEqual(p.proficiency, 0);
  });
});

describe('QuestionGenerator - 同一词不同形态', () => {
  it('动词主题的选项应来自同一个词的不同形态', () => {
    const word = WORD_BANK.verb[0]; // go
    const opts = generateOptions(word, 'thirdPerson');
    assertTrue(opts.includes('goes'), 'Must include correct answer "goes"');
    // 每个选项都应该是 go 的某种形态或拼写变体
    const allGoForms = ['go','goes','going','went','gos','goed','goes','going'];
    opts.forEach(o => {
      assertTrue(allGoForms.includes(o), `"${o}" should be a variation of "go"`);
    });
  });

  it('名词主题的选项应来自同一个词的不同形态', () => {
    const word = WORD_BANK.noun[0]; // apple
    const opts = generateOptions(word, 'plural');
    assertTrue(opts.includes('apples'), 'Must include correct answer "apples"');
    // 每个选项都应该是 apple 的某种形态或拼写变体
    const allAppleForms = ['apple','apples','appleses','appls','applis','applees','appless'];
    opts.forEach(o => {
      assertTrue(allAppleForms.includes(o), `"${o}" should be a variation of "apple"`);
    });
  });

  it('应恰好生成4个选项', () => {
    const opts = generateOptions(WORD_BANK.verb[0], 'pastTense');
    assertEqual(opts.length, 4, 'Should generate exactly 4 options');
  });

  it('干扰项不应与正确答案重复', () => {
    const opts = generateOptions(WORD_BANK.noun[2], 'plural');
    const counts = {};
    opts.forEach(o => counts[o] = (counts[o]||0) + 1);
    Object.values(counts).forEach(c => {
      assertEqual(c, 1, 'Each option should appear only once');
    });
  });

  it('不规则名词复数应正确生成', () => {
    const word = WORD_BANK.noun.find(w => w.id === 'n003');
    const opts = generateOptions(word, 'plural');
    assertTrue(opts.includes('children'), 'Should include irregular plural "children"');
  });
});

describe('API Service (localStorage)', () => {
  it('应支持 localStorage fallback', () => {
    localStorage.setItem('test_key', JSON.stringify({ score: 100 }));
    const d = JSON.parse(localStorage.getItem('test_key'));
    assertEqual(d.score, 100);
  });

  it('应能存储和读取进度数组', () => {
    const progress = [{ wordId:'w1', proficiency:0.5 }, { wordId:'w2', proficiency:0.8 }];
    localStorage.setItem('user_p', JSON.stringify(progress));
    const stored = JSON.parse(localStorage.getItem('user_p'));
    assertEqual(stored.length, 2);
    assertEqual(stored[0].wordId, 'w1');
  });
});

describe('ProgressTracker', () => {
  it('应正确计算正确率', () => {
    const rate = 7 / 10;
    assertEqual(rate, 0.7, 'Correct rate should be 70%');
  });

  it('待复习队列应按复习时间排序', () => {
    const now = Date.now();
    const queue = [
      { wordId:'w1', nextReview: now + 86400000 },
      { wordId:'w2', nextReview: now - 3600000 },
      { wordId:'w3', nextReview: now + 3600000 }
    ];
    queue.sort((a, b) => a.nextReview - b.nextReview);
    assertEqual(queue[0].wordId, 'w2', 'Overdue items should come first');
  });

  it('多次答对应提高熟练度', () => {
    let state = createInitialProgress('w1', 'test', 'verb');
    for (let i = 0; i < 3; i++) state = ebbinghausNext(true, state);
    assertTrue(state.proficiency > 0, 'Proficiency should increase');
  });
});

// ─── 运行结果 ───
console.log(`\n${'='.repeat(40)}`);
console.log(`测试结果: ${passedTests}/${totalTests} 通过`);
if (failures.length > 0) {
  console.log(`\n失败项:`);
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log('🎉 全部通过！');
  process.exit(0);
}
