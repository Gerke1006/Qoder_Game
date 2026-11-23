import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// 仅验证纯模块和静态配置；不证明 Phaser 实体、场景时序或完整战斗循环。
const root = fileURLToPath(new URL('../', import.meta.url));
const difficulties = [
  { id: 'easy', baseHp: 130, enemyHpMult: 0.75, enemySpeedMult: 0.85 },
  { id: 'normal', baseHp: 100, enemyHpMult: 1, enemySpeedMult: 1 },
  { id: 'hard', baseHp: 80, enemyHpMult: 1.35, enemySpeedMult: 1.15 }
];
const waves = [
  { spawns: { grunt: 5 }, breakMs: 4000 },
  { spawns: { grunt: 6, runner: 2 }, breakMs: 4000 },
  { spawns: { grunt: 7, runner: 5 }, breakMs: 4500 },
  { spawns: { grunt: 9, runner: 7 }, breakMs: 5000 },
  { spawns: { grunt: 6, runner: 4, boss: 1 }, breakMs: 0 }
];

let server;
let state;
let combat;
let waveSystem;
let upgrades;
let difficultyConfig;
let waveConfig;
let playerConfig;
let rewardConfig;
let rewards;
let enemyConfig;

function initialState(difficulty) {
  const { baseHp } = difficulties.find(({ id }) => id === difficulty);
  return {
    phase: 'idle',
    difficulty,
    currentWave: -1,
    totalWaves: 5,
    baseHp,
    baseMaxHp: baseHp,
    baseDefense: 0,
    gold: 0,
    kills: 0,
    elapsedMs: 0,
    attackDamageBonus: 0,
    fireRateBonus: 0,
    takenRewardIds: []
  };
}

function withRandom(t, value, check) {
  const original = Math.random;
  const random = t.mock.method(Math, 'random', () => value);
  try {
    return check(random);
  } finally {
    random.mock.restore();
    assert.equal(Math.random, original, 'restore randomness even after an assertion fails');
  }
}

function countEnemies(queue) {
  return Object.fromEntries(
    ['grunt', 'runner', 'boss'].map((type) => [
      type, queue.filter((entry) => entry === type).length
    ])
  );
}

function populateRun() {
  state.setPhase('finished');
  state.setCurrentWave(4);
  state.setBaseMaxHp(200);
  state.healBase(200);
  state.damageBase(33);
  state.addGold(123);
  state.addKill();
  state.addKill();
  state.addElapsed(12345);
  state.addAttackDamageBonus(17);
  state.addFireRateBonus(1.2);
  state.addBaseDefense(3);
  state.recordReward('sharpened-tips');
  state.recordReward('quick-draw');
}

// 共享同一个模块图并串行运行，避免状态实例分叉或随机数 mock 重叠。
describe('G2/G3 pure combat and progression modules', { concurrency: false }, () => {
  before(async () => {
    server = await createServer({
      root,
      configFile: false,
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true, include: [] }
    });
    [state, combat, waveSystem, upgrades, difficultyConfig, waveConfig, playerConfig, rewardConfig, rewards, enemyConfig] =
      await Promise.all([
        '/src/game/state/GameState.ts',
        '/src/game/systems/CombatSystem.ts',
        '/src/game/systems/WaveSystem.ts',
        '/src/game/systems/UpgradeSystem.ts',
        '/src/game/data/DifficultyConfig.ts',
        '/src/game/data/WaveConfig.ts',
        '/src/game/data/PlayerConfig.ts',
        '/src/game/data/RewardConfig.ts',
        '/src/game/systems/RewardSystem.ts',
        '/src/game/data/EnemyConfig.ts'
      ].map((path) => server.ssrLoadModule(path)));
  });

  after(async () => {
    await server?.close();
  });

  beforeEach(() => {
    state.resetRun('normal');
  });

  for (const { id, baseHp, enemyHpMult, enemySpeedMult } of difficulties) {
    test(`${id}: initial state and configured difficulty multipliers`, () => {
      state.resetRun(id);
      assert.deepEqual(state.getRunState(), initialState(id));
      const profile = difficultyConfig.DIFFICULTY_CONFIGS[id];
      assert.equal(profile.baseHp, baseHp);
      assert.equal(profile.enemyHpMult, enemyHpMult);
      assert.equal(profile.enemySpeedMult, enemySpeedMult);
      assert.deepEqual(difficultyConfig.DIFFICULTY_ORDER, ['easy', 'normal', 'hard']);
    });
  }

  test('shared player base damage and fire-rate configuration', () => {
    assert.equal(playerConfig.PLAYER_CONFIG.baseDamage, 12);
    assert.equal(playerConfig.PLAYER_CONFIG.fireRate, 2.4);
    assert.equal(playerConfig.PLAYER_CONFIG.skillDamage, 10);
    assert.equal(combat.resolveDamage(playerConfig.PLAYER_CONFIG.baseDamage), 12);
  });

  for (const [index, expected] of waves.entries()) {
    test(`wave ${index + 1}: composition, boss last, fresh queue and unchanged config`, (t) => {
      const snapshot = structuredClone(waveConfig.WAVE_CONFIGS);
      assert.equal(waveConfig.TOTAL_WAVES, 5);
      assert.equal(waveConfig.WAVE_CONFIGS.length, 5);
      assert.deepEqual(waveConfig.WAVE_CONFIGS[index].spawns, expected.spawns);
      assert.equal(waveSystem.getBreakMs(index), expected.breakMs);
      const counts = { grunt: 0, runner: 0, boss: 0, ...expected.spawns };
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      for (const random of [0, 0.5, 1 - Number.EPSILON]) {
        withRandom(t, random, () => {
          const queue = waveSystem.buildSpawnQueue(index);
          assert.equal(queue.length, total);
          assert.deepEqual(countEnemies(queue), counts);
          const nonBossCount = total - counts.boss;
          assert.ok(queue.slice(0, nonBossCount).every((type) => type !== 'boss'));
          assert.deepEqual(queue.slice(nonBossCount), Array(counts.boss).fill('boss'));
          const second = waveSystem.buildSpawnQueue(index);
          assert.notEqual(queue, second);
          assert.deepEqual(queue, second, 'fixed randomness makes the queue reproducible');
          queue.length = 0;
          assert.equal(second.length, total, 'queues must not share storage');
          assert.deepEqual(countEnemies(waveSystem.buildSpawnQueue(index)), counts);
        });
      }
      assert.deepEqual(waveConfig.WAVE_CONFIGS, snapshot);
    });
  }

  test('out-of-range waves have no spawns or break time', () => {
    for (const index of [-1, 5, 100]) {
      assert.deepEqual(waveSystem.buildSpawnQueue(index), []);
      assert.equal(waveSystem.getBreakMs(index), 0);
    }
  });

  test('last-wave boundary uses zero-based indices and remains true beyond the end', () => {
    for (const index of [-1, 0, 1, 2, 3]) {
      assert.equal(waveSystem.isLastWave(index), false);
    }
    for (const index of [4, 5, 100]) {
      assert.equal(waveSystem.isLastWave(index), true);
    }
  });

  test('damage bonuses accumulate for both basic and skill damage', () => {
    state.addAttackDamageBonus(6);
    state.addAttackDamageBonus(14);
    assert.equal(state.getRunState().attackDamageBonus, 20);
    assert.equal(combat.resolveDamage(playerConfig.PLAYER_CONFIG.baseDamage), 32);
    assert.equal(combat.resolveDamage(playerConfig.PLAYER_CONFIG.skillDamage), 30);
  });

  test('resolved damage rounds after adding the bonus and never falls below one', () => {
    assert.equal(combat.resolveDamage(12.49), 12);
    assert.equal(combat.resolveDamage(12.5), 13);
    assert.equal(combat.resolveDamage(0), 1);
    assert.equal(combat.resolveDamage(-100), 1);
    state.addAttackDamageBonus(0.25);
    assert.equal(combat.resolveDamage(12.25), 13);
    assert.equal(combat.resolveDamage(-100), 1);
  });

  for (const [label, value, crit] of [
    ['zero', 0, true],
    ['just below 15%', 0.15 - Number.EPSILON, true],
    ['exactly 15%', 0.15, false],
    ['just above 15%', 0.15 + Number.EPSILON, false],
    ['near one', 1 - Number.EPSILON, false]
  ]) {
    test(`critical roll at ${label}`, (t) => {
      assert.equal(combat.CRIT_CHANCE, 0.15);
      assert.equal(combat.CRIT_MULTIPLIER, 2);
      state.addAttackDamageBonus(6.5);
      withRandom(t, value, (random) => {
        assert.deepEqual(combat.rollDamage(12), { amount: crit ? 38 : 19, crit });
        assert.equal(random.mock.callCount(), 1);
      });
    });
  }

  test('Damageable contract: a live target receives one rolled damage value', (t) => {
    // Interface spy only: this does not model Enemy, Boss, death or collision logic.
    const target = { hp: 100, maxHp: 100, alive: true, takeDamage: t.mock.fn() };
    state.addAttackDamageBonus(6);
    withRandom(t, 0, (random) => {
      assert.deepEqual(combat.applyDamage(target, 12), { amount: 36, crit: true });
      assert.equal(target.takeDamage.mock.callCount(), 1);
      assert.deepEqual(target.takeDamage.mock.calls[0].arguments, [36]);
      assert.equal(random.mock.callCount(), 1);
    });
  });

  test('Damageable contract: an already-dead target is not damaged or rolled again', (t) => {
    const target = { hp: 0, maxHp: 100, alive: false, takeDamage: t.mock.fn() };
    withRandom(t, 0, (random) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        assert.deepEqual(combat.applyDamage(target, 12), { amount: 0, crit: false });
      }
      assert.equal(target.takeDamage.mock.callCount(), 0);
      assert.equal(random.mock.callCount(), 0);
    });
  });

  test('base damage subtracts HP and clamps overkill to zero', () => {
    state.damageBase(25);
    assert.equal(state.getRunState().baseHp, 75);
    state.damageBase(1000);
    assert.equal(state.getRunState().baseHp, 0);
    state.damageBase(1);
    assert.equal(state.getRunState().baseHp, 0);
    assert.equal(state.getRunState().baseMaxHp, 100);
  });

  test('base healing adds HP and clamps to the current maximum', () => {
    state.damageBase(70);
    state.healBase(20);
    assert.equal(state.getRunState().baseHp, 50);
    state.healBase(1000);
    assert.equal(state.getRunState().baseHp, 100);
    state.healBase(1);
    assert.equal(state.getRunState().baseHp, 100);
  });

  test('lowering max HP clamps current HP; raising it does not automatically heal', () => {
    state.setBaseMaxHp(60);
    assert.equal(state.getRunState().baseHp, 60);
    assert.equal(state.getRunState().baseMaxHp, 60);
    state.setBaseMaxHp(150);
    assert.equal(state.getRunState().baseHp, 60);
    assert.equal(state.getRunState().baseMaxHp, 150);
    state.healBase(1000);
    assert.equal(state.getRunState().baseHp, 150);
    state.setBaseMaxHp(0);
    assert.equal(state.getRunState().baseHp, 0);
    assert.equal(state.getRunState().baseMaxHp, 0);
  });

  for (const { kind, ids, changes } of [
    { kind: 'baseHp', ids: ['repair-plate', 'oak-heart'], changes: { baseHp: 145, baseMaxHp: 175 } },
    { kind: 'gold', ids: ['gold-cache', 'dragon-hoard'], changes: { gold: 165 } },
    { kind: 'damage', ids: ['sharpened-tips', 'war-horn', 'sun-blessing'], changes: { attackDamageBonus: 42 } },
    { kind: 'speed', ids: ['quick-draw', 'wind-feather'], changes: { fireRateBonus: 0.6 + 1.2 } }
  ]) {
    test(`${kind} rewards apply cumulatively, record IDs and leave unrelated state/config intact`, () => {
      state.damageBase(30);
      state.addGold(5);
      const beforeState = structuredClone(state.getRunState());
      const beforeConfig = structuredClone(rewardConfig.REWARD_CONFIGS);
      const rewards = rewardConfig.REWARD_CONFIGS.filter((reward) => reward.effect.kind === kind);
      assert.deepEqual(rewards.map((reward) => reward.id), ids);
      for (const reward of rewards) upgrades.applyReward(reward);
      assert.deepEqual(state.getRunState(), { ...beforeState, ...changes, takenRewardIds: ids });
      assert.deepEqual(rewardConfig.REWARD_CONFIGS, beforeConfig);
      if (kind === 'damage') {
        assert.equal(combat.resolveDamage(playerConfig.PLAYER_CONFIG.baseDamage), 54);
        assert.equal(combat.resolveDamage(playerConfig.PLAYER_CONFIG.skillDamage), 52);
      }
    });
  }

  test('recordReward retains first-acquisition order without duplicate IDs', () => {
    state.recordReward('quick-draw');
    state.recordReward('sharpened-tips');
    state.recordReward('quick-draw');
    assert.deepEqual(state.getRunState().takenRewardIds, ['quick-draw', 'sharpened-tips']);
  });

  test('gold clamps to zero, while kills and elapsed time accumulate', () => {
    state.addGold(40);
    state.addGold(-15);
    assert.equal(state.getRunState().gold, 25);
    state.addGold(-100);
    assert.equal(state.getRunState().gold, 0);
    state.addKill();
    state.addKill();
    state.addElapsed(16.5);
    state.addElapsed(33.5);
    assert.equal(state.getRunState().kills, 2);
    assert.equal(state.getRunState().elapsedMs, 50);
  });

  test('summaries are stable snapshots with independent reward arrays', () => {
    populateRun();
    const summary = state.getRunSummary(true);
    const lossSummary = state.getRunSummary(false);
    const expected = {
      win: true,
      wave: 4,
      totalWaves: 5,
      kills: 2,
      gold: 123,
      elapsedMs: 12345,
      takenRewardIds: ['sharpened-tips', 'quick-draw']
    };
    assert.deepEqual(summary, expected);
    assert.deepEqual(lossSummary, { ...expected, win: false });
    assert.notEqual(summary.takenRewardIds, state.getRunState().takenRewardIds);
    assert.notEqual(summary.takenRewardIds, lossSummary.takenRewardIds);
    lossSummary.takenRewardIds.push('summary-only');
    assert.deepEqual(state.getRunState().takenRewardIds, expected.takenRewardIds);
    state.addGold(10);
    state.addKill();
    state.addElapsed(50);
    state.setCurrentWave(2);
    state.recordReward('gold-cache');
    assert.deepEqual(summary, expected);
    assert.deepEqual(lossSummary.takenRewardIds, [...expected.takenRewardIds, 'summary-only']);
    state.resetRun('easy');
    assert.deepEqual(summary, expected);
  });

  for (const { id } of difficulties) {
    test(`resetRun(${id}) clears all run progress and uses the requested difficulty`, () => {
      populateRun();
      const previousRewards = state.getRunState().takenRewardIds;
      state.resetRun(id);
      assert.deepEqual(state.getRunState(), initialState(id));
      assert.notEqual(state.getRunState().takenRewardIds, previousRewards);
      assert.deepEqual(previousRewards, ['sharpened-tips', 'quick-draw']);
      assert.equal(combat.resolveDamage(12), 12);
    });
  }

  test('G3-02/03: growing wave HP, denser early waves and a final boss', () => {
    const configs = waveConfig.WAVE_CONFIGS;
    const totalHp = configs.map(wave => Object.entries(wave.spawns)
      .reduce((total, [type, count]) => total + count * enemyConfig.ENEMY_CONFIGS[type].maxHp, 0));
    assert.deepEqual(totalHp, [150, 216, 300, 396, 632]);
    for (let i = 1; i < configs.length; i++) assert.ok(totalHp[i] > totalHp[i - 1]);
    for (let i = 1; i < configs.length - 1; i++) {
      assert.ok(waveSystem.buildSpawnQueue(i).length > waveSystem.buildSpawnQueue(i - 1).length);
      assert.ok(configs[i].spawnIntervalMs < configs[i - 1].spawnIntervalMs);
    }
    assert.equal(waveSystem.buildSpawnQueue(configs.length - 1).at(-1), 'boss');
  });

  test('G3-05: random offers have no duplicates and do not mutate state or config', (t) => {
    state.recordReward('bark-guard');
    const before = structuredClone(state.getRunState());
    const config = structuredClone(rewardConfig.REWARD_CONFIGS);
    for (const value of [0, 0.5, 1 - Number.EPSILON]) {
      withRandom(t, value, () => {
        const offered = rewards.rollRewards();
        assert.equal(offered.length, rewardConfig.REWARD_OFFER_COUNT);
        assert.equal(new Set(offered.map(item => item.id)).size, offered.length);
        assert.ok(offered.every(item => !before.takenRewardIds.includes(item.id)));
      });
    }
    assert.deepEqual(state.getRunState(), before);
    assert.deepEqual(rewardConfig.REWARD_CONFIGS, config);
  });

  test('G3-05: different random rolls produce different choices', (t) => {
    const first = withRandom(t, 0, () => rewards.rollRewards().map(item => item.id));
    const last = withRandom(t, 1 - Number.EPSILON, () => rewards.rollRewards().map(item => item.id));
    assert.notDeepEqual(first, last);
  });

  for (const remaining of [0, 1, 2]) {
    test(`G3-05: pool with ${remaining} remaining rewards terminates without repeats`, () => {
      const ids = rewardConfig.REWARD_CONFIGS.map(item => item.id);
      const exclude = ids.slice(remaining);
      const snapshot = [...exclude];
      assert.deepEqual(rewards.rollRewards(3, exclude).map(item => item.id).sort(), ids.slice(0, remaining).sort());
      assert.deepEqual(exclude, snapshot);
      for (const id of exclude) state.recordReward(id);
      assert.deepEqual(rewards.rollRewards().map(item => item.id).sort(), ids.slice(0, remaining).sort());
    });
  }

  test('G3-05: zero offers and drawing more than the pool size are bounded', () => {
    assert.deepEqual(rewards.rollRewards(0), []);
    const all = rewards.rollRewards(rewardConfig.REWARD_CONFIGS.length + 10);
    assert.equal(all.length, rewardConfig.REWARD_CONFIGS.length);
    assert.equal(new Set(all.map(item => item.id)).size, all.length);
  });

  for (const [kind, id, changes] of [
    ['baseHp', 'repair-plate', { baseHp: 95, baseMaxHp: 125 }],
    ['gold', 'gold-cache', { gold: 40 }],
    ['damage', 'sharpened-tips', { attackDamageBonus: 6 }],
    ['speed', 'quick-draw', { fireRateBonus: 0.6 }],
    ['defense', 'bark-guard', { baseDefense: 1 }]
  ]) {
    test(`G3-06/07: ${kind} effect and reward ID apply exactly once`, () => {
      state.damageBase(30);
      const initial = structuredClone(state.getRunState());
      const reward = rewardConfig.REWARD_CONFIGS.find(item => item.id === id);
      assert.equal(upgrades.applyReward(reward), true);
      assert.deepEqual(state.getRunState(), { ...initial, ...changes, takenRewardIds: [id] });
      const applied = structuredClone(state.getRunState());
      assert.equal(upgrades.applyReward(reward), false);
      assert.equal(upgrades.applyReward({ ...reward }), false);
      assert.deepEqual(state.getRunState(), applied);
    });
  }

  test('G3-07: defense stacks across distinct cards, mitigates all attackers and caps at one damage', () => {
    assert.equal(combat.resolveBaseDamage(6), 6);
    upgrades.applyReward(rewardConfig.REWARD_CONFIGS.find(item => item.id === 'bark-guard'));
    assert.equal(combat.resolveBaseDamage(6), 5);
    upgrades.applyReward(rewardConfig.REWARD_CONFIGS.find(item => item.id === 'iron-bark'));
    assert.equal(state.getRunState().baseDefense, 3);
    const before = structuredClone(state.getRunState());
    assert.equal(combat.resolveBaseDamage(6), 3);
    assert.equal(combat.resolveBaseDamage(5), 2);
    assert.equal(combat.resolveBaseDamage(22), 19);
    assert.equal(combat.resolveBaseDamage(1), 1);
    assert.equal(combat.resolveBaseDamage(6.5), 4);
    assert.deepEqual(state.getRunState(), before);
    state.resetRun();
    assert.equal(state.getRunState().baseDefense, 0);
    assert.equal(combat.resolveBaseDamage(6), 6);
  });

  test('G3-09: boss cadence and kill reward are configured independently of difficulty', () => {
    assert.equal(enemyConfig.BOSS_CONFIG.summonIntervalMs, 6500);
    assert.equal(enemyConfig.BOSS_CONFIG.baseAttackIntervalMs, 2000);
    assert.equal(enemyConfig.ENEMY_CONFIGS.boss.goldReward, 60);
  });

  test('resetRun without an argument preserves the currently selected difficulty', () => {
    state.resetRun('hard');
    populateRun();
    state.resetRun();
    assert.deepEqual(state.getRunState(), initialState('hard'));
  });
});
