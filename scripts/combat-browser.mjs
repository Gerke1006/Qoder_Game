import * as Phaser from 'phaser';
import * as state from '../src/game/state/GameState.ts';
import { PLAYER_CONFIG, BASE_LINE_X } from '../src/game/data/PlayerConfig.ts';
import { ENEMY_CONFIGS, BOSS_CONFIG } from '../src/game/data/EnemyConfig.ts';
import { REWARD_CONFIGS } from '../src/game/data/RewardConfig.ts';
import { applyReward } from '../src/game/systems/UpgradeSystem.ts';
import { DIFFICULTY_CONFIGS } from '../src/game/data/DifficultyConfig.ts';
import { WAVE_CONFIGS } from '../src/game/data/WaveConfig.ts';
import { Projectile } from '../src/game/entities/Projectile.ts';
import { audio } from '../src/game/systems/AudioSystem.ts';

export async function runCombatChecks() {
  const game = window.game;
  const checks = [];
  const screenshots = {};
  const capture = (name) => {
    game.step(time, 0);
    screenshots[name] = game.canvas.toDataURL('image/png');
  };
  window.__combatChecks = checks;
  let randomSeed = 42;
  const nonCriticalRandom = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return 0.2 + (randomSeed / 4294967296) * 0.8;
  };
  const originalNow = Date.now;
  const originalRandom = Math.random;
  const rngState = Phaser.Math.RND.state();
  const originalMuted = audio.isMuted();
  const oldBest = localStorage.getItem('qoder-defense-best');
  let time = performance.now();
  let wall = originalNow();
  let battle;
  const check = (name, pass, evidence = {}) => {
    checks.push({ name, pass: Boolean(pass), ...evidence });
    if (!pass) throw new Error(`${name}: ${JSON.stringify(evidence)}`);
  };
  const step = (count = 1, delta = 1000 / 60) => {
    for (let i = 0; i < count; i++) {
      time += delta;
      wall += delta;
      game.headlessStep(time, delta);
    }
  };
  const mouse = (type, x, y, button = 0, buttons = type === 'mouseup' ? 0 : 1) => {
    const rect = game.canvas.getBoundingClientRect();
    game.canvas.dispatchEvent(new MouseEvent(type, {
      clientX: rect.left + x * rect.width / 960,
      clientY: rect.top + y * rect.height / 540,
      button, buttons, bubbles: true
    }));
  };
  const click = (x, y) => {
    game.step(time, 0);
    mouse('mousemove', x, y, 0, 0);
    mouse('mousedown', x, y);
    step();
    mouse('mouseup', x, y);
    step(2);
  };
  const key = (value, code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: value, keyCode: code, which: code, bubbles: true }));
    step();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: value, keyCode: code, which: code, bubbles: true }));
    step();
  };
  const fresh = (difficulty = 'normal') => {
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
    game.scene.processQueue();
    state.resetRun(difficulty);
    game.scene.start('Battle');
    game.scene.processQueue();
    battle = game.scene.keys.Battle;
    step(2);
    return battle;
  };
  const arena = () => {
    fresh();
    battle.beginWave();
    battle.spawnQueue = [];
    battle.spawnClock = -1e9;
  };
  const spawn = (type, x, y) => {
    battle.spawnEnemy(type, { x, y });
    return battle.enemies.at(-1);
  };
  const arrow = (x, y, damage = 12, speed = 980, angle = 0) => {
    const projectile = new Projectile(battle, x, y, damage);
    projectile.launch(angle, speed);
    battle.projectiles.push(projectile);
    return projectile;
  };
  game.loop.stop();
  audio.setMuted(true);
  Date.now = () => wall;
  Math.random = nonCriticalRandom;
  try {
    check('G2-09: actual browser viewport and renderer', innerWidth > 0 && innerHeight > 0 && !!game.renderer,
      { viewport: [innerWidth, innerHeight], renderer: game.renderer.type });
    step(2);
    const start = game.scene.keys.MainMenu.children.list.find(o => o.list?.some(t => t.text === '开始守卫'));
    check('G2-01: menu start control exists', !!start);
    click(start.x, start.y);
    battle = game.scene.keys.Battle;
    check('G2-01: mouse starts real battle', game.scene.isActive('Battle') && state.getRunState().baseHp === 100);

    for (const difficulty of ['easy', 'normal', 'hard']) {
      fresh(difficulty);
      const enemy = spawn('grunt', 600, 270);
      const profile = DIFFICULTY_CONFIGS[difficulty];
      const startX = enemy.x;
      enemy.step(100, time);
      check(`G2-01/03: ${difficulty} HP and delta-based movement`,
        state.getRunState().baseHp === profile.baseHp &&
        enemy.hp === Math.round(ENEMY_CONFIGS.grunt.maxHp * profile.enemyHpMult) &&
        Math.abs(startX - enemy.x - ENEMY_CONFIGS.grunt.speed * profile.enemySpeedMult * 0.1) < 1e-6,
        { baseHp: state.getRunState().baseHp, enemyHp: enemy.hp, movement: startX - enemy.x });
    }

    fresh();
    check('G2-02: no premature spawn in preparation', battle.enemies.length === 0);
    while (battle.mode === 'break') step();
    check('G2-02: first enemy and remaining queue', battle.enemies.length === 1 && battle.spawnQueue.length === 4);
    step(50);
    check('G2-02: spawn interval respected', battle.enemies.length === 1);
    step(20);
    check('G2-02: second timed spawn', battle.enemies.length === 2 && battle.spawnQueue.length === 3);

    arena();
    const far = spawn('grunt', 580, 280);
    const nearest = spawn('grunt', 510, 270);
    const dead = spawn('grunt', 501, 270);
    dead.takeDamage(100);
    battle.shoot(500, 270);
    const aimed = battle.projectiles.at(-1);
    check('G2-04: lock nearest living target to cursor', aimed.target === nearest && aimed.target !== far);
    battle.shoot(750, 450);
    check('G2-04: empty aim stays unlocked', battle.projectiles.at(-1).target === null);
    aimed.launch(-0.4, PLAYER_CONFIG.projectileSpeed, PLAYER_CONFIG.homingTurnRate);
    const beforeAngle = aimed.velocity.angle();
    aimed.step(16);
    check('G2-04: homing turns toward living target without changing speed',
      Phaser.Math.Angle.Wrap(aimed.velocity.angle() - beforeAngle) > 0 &&
      Math.abs(aimed.velocity.length() - PLAYER_CONFIG.projectileSpeed) < 1e-6);
    nearest.takeDamage(100);
    const direction = aimed.velocity.angle();
    aimed.step(16);
    check('G2-04: dead lock continues straight', aimed.velocity.angle() === direction);

    arena();
    const graze = spawn('runner', 400, 270);
    const grazingArrow = arrow(376, 294);
    battle.stepProjectiles(48);
    check('G2-04/05: swept hit catches fast grazing arrow at 48ms', graze.hp === 6 && !grazingArrow.active,
      { hp: graze.hp });
    arena();
    const farther = spawn('runner', 440, 270);
    const nearer = spawn('runner', 400, 270);
    arrow(300, 270, 12, 4000);
    battle.stepProjectiles(48);
    check('G2-04: first collision wins, not spawn-array order', nearer.hp === 6 && farther.hp === 18);
    arena();
    const edge = spawn('runner', 990, 270);
    const edgeArrow = arrow(970, 270);
    battle.stepProjectiles(48);
    check('G2-04: hit before out-of-bounds cleanup', edge.hp === 6 && !edgeArrow.active);
    const miss = arrow(900, 500);
    battle.stepProjectiles(150);
    check('G2-04: missed offscreen arrow removed', !miss.active && !battle.projectiles.includes(miss));
    const geometry = arrow(0, 0, 12, 100);
    geometry.step(100);
    check('G2-04: tangent, overlap, miss and segment bounds',
      geometry.hitFraction({ x: 5, y: 1 }, 1) === 0.5 &&
      geometry.hitFraction({ x: 0, y: 0 }, 1) === 0 &&
      geometry.hitFraction({ x: 5, y: 2 }, 1) === null &&
      geometry.hitFraction({ x: 20, y: 0 }, 1) === null);
    geometry.step(0);
    check('G2-04: stationary segment does not divide by zero',
      geometry.hitFraction({ x: 10, y: 0 }, 1) === 0 && geometry.hitFraction({ x: 20, y: 0 }, 1) === null);

    arena();
    const target = spawn('grunt', 600, 270);
    arrow(600, 270, 12, 0);
    battle.stepProjectiles(16);
    check('G2-05/06: normal hit updates HP and feedback', target.hp === 18 && target.alive && target.sprite.isTinted);
    state.addAttackDamageBonus(6);
    Math.random = () => 0;
    arrow(600, 270, 12, 0);
    arrow(600, 270, 12, 0);
    battle.stepProjectiles(16);
    Math.random = nonCriticalRandom;
    const deathX = target.x;
    target.step(100, time);
    target.takeDamage(100);
    check('G2-05/06: critical overkill, single reward, no corpse movement',
      target.hp === 0 && !target.alive && target.x === deathX && state.getRunState().kills === 1 && state.getRunState().gold === 3);
    step(40);
    check('G2-06: death animation disposes entity', !target.active && !battle.enemies.includes(target));

    arena();
    const invader = spawn('grunt', BASE_LINE_X + 0.1, 270);
    battle.update(time, 16);
    const hpAfterContact = state.getRunState().baseHp;
    battle.update(time + 16, 16);
    check('G2-07: base hit once, no kill reward, HUD synchronized',
      hpAfterContact === 94 && state.getRunState().baseHp === 94 && !invader.active &&
      state.getRunState().kills === 0 && battle.hud.hpText.text.includes('94 / 100'));

    arena();
    spawn('grunt', 600, 270);
    mouse('mousedown', 600, 270, 2, 2);
    step();
    check('G2-04: right mouse does not shoot', !battle.pointerHeld && battle.projectiles.length === 0);
    mouse('mouseup', 600, 270, 2);
    mouse('mousedown', 600, 270);
    step(100);
    mouse('mouseup', 600, 270);
    check('G2-04/06: real held-left input fires and kills', state.getRunState().kills === 1 && !battle.pointerHeld,
      { kills: state.getRunState().kills, pointerHeld: battle.pointerHeld, enemyHp: battle.enemies.map(e => e.hp) });
    arena();
    spawn('grunt', 600, 270);
    click(806, 28);
    audio.setMuted(true);
    check('G2-04: HUD click does not arm basic attack', !battle.pointerHeld && battle.projectiles.length === 0);
    mouse('mousedown', 600, 270);
    step();
    const rect = game.canvas.getBoundingClientRect();
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.right + 20, clientY: rect.bottom + 20, button: 0, buttons: 0, bubbles: true }));
    check('G2-04: releasing outside canvas stops fire', !battle.pointerHeld);
    mouse('mousedown', 600, 270);
    game.events.emit(Phaser.Core.Events.BLUR);
    check('G2-04: focus loss stops held fire', !battle.pointerHeld);
    mouse('mouseup', 600, 270);

    arena();
    const pausedEnemy = spawn('boss', 650, 270);
    click(906, 486);
    check('G2-04: skill creates configured arrows and starts cooldown', battle.projectiles.length === PLAYER_CONFIG.skillArrows && battle.skillRemaining > 7900);
    const arrowsBefore = battle.projectiles.length;
    key(' ', 32);
    check('G2-04: skill cannot bypass cooldown', battle.projectiles.length === arrowsBefore);
    key('Escape', 27);
    const frozen = { x: pausedEnemy.x, hp: state.getRunState().baseHp, elapsed: state.getRunState().elapsedMs, cooldown: battle.skillRemaining, queue: battle.spawnQueue.length };
    step(120);
    check('G2-08: pause freezes movement, HP, elapsed, spawning and cooldown', battle.paused && battle.pausePanel.visible &&
      JSON.stringify(frozen) === JSON.stringify({ x: pausedEnemy.x, hp: state.getRunState().baseHp, elapsed: state.getRunState().elapsedMs, cooldown: battle.skillRemaining, queue: battle.spawnQueue.length }));
    key('Escape', 27);
    step(60);
    check('G2-08: resume restores combat', !battle.paused && pausedEnemy.x < frozen.x && battle.skillRemaining < frozen.cooldown);

    arena();
    spawn('boss', 700, 270);
    step(400);
    check('G2-02: living boss summons two enemies', battle.enemies.filter(e => e.stats.type === 'grunt').length === 2);

    arena();
    battle.waveCleared();
    const rewardElapsed = state.getRunState().elapsedMs;
    step(60);
    check('G2-08: reward selection freezes combat time', state.getRunState().elapsedMs === rewardElapsed);
    const cards = battle.rewardPanel.root.list.filter(o => o.getData('choose'));
    click(cards[0].x, cards[0].y);
    key('2', 50);
    step(30);
    check('G2-08: reward only applied once and does not fire through modal', state.getRunState().takenRewardIds.length === 1 && battle.waveIndex === 1 && !battle.pointerHeld && !battle.rewardPanel.visible,
      { rewards: state.getRunState().takenRewardIds, wave: battle.waveIndex, held: battle.pointerHeld, visible: battle.rewardPanel.visible, mode: battle.mode });
    battle.beginWave();
    battle.spawnQueue = [];
    battle.waveCleared();
    key('Escape', 27);
    step(20);
    check('G2-08: reward skip preserves partner gesture behavior', !battle.rewardPanel.visible && battle.waveIndex === 2 && state.getRunState().takenRewardIds.length === 1);

    arena();
    state.damageBase(94);
    spawn('grunt', BASE_LINE_X, 270);
    const laterInvader = spawn('grunt', BASE_LINE_X, 270);
    const lastTarget = spawn('runner', 500, 270);
    arrow(500, 270, 100, 0);
    battle.update(time, 16);
    check('G2-07/08: fatal contact stops same-frame damage and rewards',
      state.getRunState().baseHp === 0 && state.getRunState().kills === 0 && state.getRunState().gold === 0 &&
      lastTarget.hp === 18 && laterInvader.active && battle.mode === 'over' && battle.hud.hpText.text.includes('0 / 100'));
    const terminalState = JSON.stringify(state.getRunState());
    battle.update(time + 16, 16);
    check('G2-08: terminal state is immutable to later frames', JSON.stringify(state.getRunState()) === terminalState);
    step(100);
    const loss = { ...game.scene.keys.Result.summary };
    check('G2-08: loss snapshot matches terminal state', game.scene.isActive('Result') && loss.win === false && loss.kills === 0 && loss.gold === 0);
    check('G2-08: scene shutdown removes inputs', battle.children.length === 0 && battle.input.keyboard.listenerCount('keydown-ESC') === 0 &&
      battle.input.listenerCount('pointerupoutside') === 0 && !game.events.listeners('blur').some(fn => fn === battle.onPointerUp));
    key('Enter', 13);
    battle = game.scene.keys.Battle;
    check('G2-08: Enter restarts fresh run', game.scene.isActive('Battle') && state.getRunState().baseHp === 100 && state.getRunState().kills === 0 &&
      state.getRunState().takenRewardIds.length === 0 && battle.projectiles.length === 0 && battle.skillRemaining === 0 && !battle.pointerHeld);
    for (let repeat = 0; repeat < 3; repeat++) {
      key('Escape', 27);
      click(480, 254);
      battle = game.scene.keys.Battle;
      check(`G2-08: pause restart ${repeat + 1} has one set of listeners`,
        !battle.paused && battle.input.keyboard.listenerCount('keydown-ESC') === 1 && battle.input.keyboard.listenerCount('keydown-SPACE') === 1 &&
        battle.input.listenerCount('pointerdown') === 1 && battle.input.listenerCount('pointerupoutside') === 1 &&
        game.events.listeners('blur').filter(fn => fn === battle.onPointerUp).length === 1 && battle.enemies.length === 0);
    }

    arena();
    battle.spawnQueue = ['grunt'];
    step();
    check('G3-01: empty field does not end a wave with pending spawns', battle.mode === 'fight');
    battle.spawnQueue = [];
    const survivor = spawn('grunt', 500, 270);
    step();
    check('G3-01: empty spawn queue does not end a wave with living enemies', battle.mode === 'fight');
    arrow(survivor.x, survivor.y, 100, 0);
    battle.stepProjectiles(16);
    step();
    check('G3-01: death animation finishes before reward settlement', battle.mode === 'fight' && !survivor.alive && survivor.active);
    const leftover = arrow(400, 450, 12, 0);
    step(40);
    check('G3-01/04: cleared wave settles once and discards leftover projectiles', battle.mode === 'reward' && !leftover.active && battle.projectiles.length === 0 && state.getRunState().gold === 3);
    const modal = battle.rewardPanel.root;
    battle.waveCleared();
    check('G3-04: repeated clear cannot reroll an open reward panel', battle.rewardPanel.root === modal);

    for (const [id, changes, hudField, hudValue] of [
      ['sharpened-tips', { attackDamageBonus: 6 }, 'damageText', '18'],
      ['quick-draw', { fireRateBonus: 0.6 }, 'speedText', '3.0/s'],
      ['repair-plate', { baseHp: 105, baseMaxHp: 125 }, 'hpText', '基地 105 / 125'],
      ['gold-cache', { gold: 40 }, 'goldText', '40'],
      ['bark-guard', { baseDefense: 1 }, 'defenseText', '1']
    ]) {
      arena();
      state.damageBase(20);
      battle.hud.refresh();
      const rewardIndex = REWARD_CONFIGS.findIndex(item => item.id === id);
      let firstDraw = true;
      Math.random = () => {
        if (!firstDraw) return nonCriticalRandom();
        firstDraw = false;
        return (rewardIndex + 0.25) / REWARD_CONFIGS.length;
      };
      battle.waveCleared();
      Math.random = nonCriticalRandom;
      step(50);
      const offered = battle.rewardPanel.root.list.filter(o => o.getData('choose'));
      check(`G3-05: ${id} can be rolled into a rendered card`, offered[0].list.some(o => o.text === REWARD_CONFIGS[rewardIndex].title));
      if (id === 'bark-guard') capture('progression-rewards');
      if (id === 'quick-draw') key('1', 49);
      else click(offered[0].x, offered[0].y);
      step(30);
      check(`G3-06/07/08: ${id} selection applies its effect and refreshes HUD`,
        state.getRunState().takenRewardIds.join() === id && battle.waveIndex === 1 && battle.mode === 'break' &&
        Object.entries(changes).every(([field, value]) => state.getRunState()[field] === value) && battle.hud[hudField].text === hudValue,
        { state: { ...state.getRunState() }, hud: battle.hud[hudField].text });
      if (id === 'sharpened-tips' || id === 'quick-draw') {
        battle.beginWave();
        battle.spawnQueue = [];
        battle.spawnClock = -1e9;
        const dummy = spawn('boss', id === 'sharpened-tips' ? 230 : 700, 270);
        if (id === 'sharpened-tips') {
          battle.shoot(dummy.x, dummy.y);
          battle.stepProjectiles(16);
          check('G3-07: selected damage upgrade increases real basic projectile damage', dummy.hp === dummy.maxHp - 18);
          battle.castSkill();
          battle.stepProjectiles(16);
          check('G3-07: the same damage upgrade also increases every skill arrow', dummy.hp === dummy.maxHp - 18 - PLAYER_CONFIG.skillArrows * 16);
        } else {
          game.step(time, 0);
          mouse('mousedown', dummy.x, dummy.y);
          step();
          check('G3-07: selected fire-rate upgrade shortens the real firing interval', Math.abs(battle.fireClock - 1000 / 3) < 1e-6);
          step(18);
          check('G3-07: upgraded fire still respects its cooldown', battle.projectiles.length === 1);
          step(3);
          mouse('mouseup', dummy.x, dummy.y);
          check('G3-07: upgraded attack fires again before the original interval', battle.projectiles.length === 2);
        }
      }
      if (id === 'bark-guard') {
        battle.beginWave();
        battle.spawnQueue = [];
        battle.spawnClock = -1e9;
        spawn('grunt', 700, 270);
        spawn('grunt', BASE_LINE_X, 270);
        step();
        check('G3-07: selected defense reduces real base contact and HP display', state.getRunState().baseHp === 75 && battle.hud.hpText.text === '基地 75 / 100');
        step(110);
        capture('progression-defense');
      }
    }

    for (let wave = 0; wave < WAVE_CONFIGS.length - 1; wave++) {
      arena();
      battle.waveIndex = wave;
      battle.waveCleared();
      battle.pickReward();
      const duration = battle.breakRemaining;
      check(`G3-01: rest after wave ${wave + 1} uses the cleared wave's duration`, duration === WAVE_CONFIGS[wave].breakMs,
        { duration, nextWave: battle.waveIndex });
      step(Math.floor((duration - 1) / (1000 / 60)));
      check(`G3-01: wave ${wave + 2} cannot skip its preparation`, battle.mode === 'break' && battle.enemies.length === 0);
      while (battle.mode === 'break') step();
      check(`G3-01/02: wave ${wave + 2} starts automatically after rest`, state.getRunState().currentWave === wave + 1 && battle.mode === 'fight' && battle.enemies.length === 1);
    }

    arena();
    battle.waveIndex = WAVE_CONFIGS.length - 1;
    state.setCurrentWave(battle.waveIndex);
    applyReward(REWARD_CONFIGS.find(item => item.id === 'bark-guard'));
    applyReward(REWARD_CONFIGS.find(item => item.id === 'iron-bark'));
    const siegeBoss = spawn('boss', BASE_LINE_X + 0.1, 270);
    step();
    check('G3-09: boss reaching the base remains alive and attacks with defense mitigation', siegeBoss.alive && siegeBoss.active && siegeBoss.x === BASE_LINE_X && state.getRunState().baseHp === 81 && battle.mode === 'fight');
    step(60);
    check('G3-09: boss does not deal contact damage every frame', state.getRunState().baseHp === 81);
    key('Escape', 27);
    const attackClock = siegeBoss.attackClock;
    step(180);
    check('G3-09: pausing also freezes the boss siege timer', siegeBoss.attackClock === attackClock && state.getRunState().baseHp === 81);
    key('Escape', 27);
    step(Math.ceil(siegeBoss.attackClock / (1000 / 60)) + 1);
    check('G3-09: configured siege interval deals a second hit, not a false victory', state.getRunState().baseHp === 62 && battle.mode === 'fight' && state.getRunState().gold === 0,
      { interval: BOSS_CONFIG.baseAttackIntervalMs, hp: state.getRunState().baseHp });
    for (let frame = 0; frame < 1000 && !game.scene.isActive('Result'); frame++) step();
    check('G3-09/10: surviving boss destroys the base and produces defeat', game.scene.isActive('Result') && !game.scene.keys.Result.summary.win && state.getRunState().baseHp === 0 && siegeBoss.hp > 0 && state.getRunState().kills === 0);
    key('Enter', 13);
    battle = game.scene.keys.Battle;
    check('G3-07/10: restart resets defense, every upgrade and resources', state.getRunState().baseDefense === 0 && state.getRunState().attackDamageBonus === 0 && state.getRunState().fireRateBonus === 0 && state.getRunState().baseHp === 100 && state.getRunState().baseMaxHp === 100 && state.getRunState().gold === 0 && state.getRunState().takenRewardIds.length === 0 && battle.hud.defenseText.text === '0');

    arena();
    battle.waveIndex = WAVE_CONFIGS.length - 1;
    state.setCurrentWave(battle.waveIndex);
    const summoner = spawn('boss', 700, 270);
    step(400);
    arrow(summoner.x, summoner.y, summoner.maxHp, 0);
    battle.stepProjectiles(16);
    step(40);
    check('G3-09: dead boss pays once but its surviving summons still block victory', summoner.hp === 0 && battle.mode === 'fight' && battle.enemies.filter(e => e.alive).length === 2 && state.getRunState().gold === 60 && state.getRunState().kills === 1);
    for (const enemy of battle.enemies) arrow(enemy.x, enemy.y, 100, 0);
    battle.stepProjectiles(16);
    step(120);
    check('G3-04/08/09: clearing boss and summons wins without an extra reward round', game.scene.isActive('Result') && game.scene.keys.Result.summary.win && state.getRunState().gold === 66 && state.getRunState().kills === 3 && state.getRunState().takenRewardIds.length === 0);

    const playRun = (shooting) => {
      fresh();
      let seed = shooting ? 20261123 : 20261124;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      Phaser.Math.RND.sow([String(seed)]);
      let bossKilled = false;
      let seenBoss = null;
      const seenEnemies = new Set();
      const waveStarts = [];
      const rewardRounds = [];
      let frame;
      for (frame = 0; frame < 20000 && !game.scene.isActive('Result'); frame++) {
        for (const enemy of battle.enemies) seenEnemies.add(enemy);
        if (battle.mode === 'fight' && !waveStarts.includes(battle.waveIndex)) {
          waveStarts.push(battle.waveIndex);
          const expected = Object.values(WAVE_CONFIGS[battle.waveIndex].spawns).reduce((a, b) => a + b, 0);
          check(`G3-01/02: ${shooting ? 'armed' : 'unarmed'} run wave ${battle.waveIndex + 1} has configured spawns`,
            battle.enemies.length + battle.spawnQueue.length === expected);
        }
        if (battle.mode === 'reward' && !battle.rewardPanel.locked) {
          mouse('mouseup', 700, 270);
          step(50);
          const options = battle.rewardPanel.root.list.filter(o => o.getData('choose'));
          const candidates = options.map(card => REWARD_CONFIGS.find(reward => card.list.some(o => o.text === reward.title)).id);
          check(`G3-05: ${shooting ? 'armed' : 'unarmed'} run wave ${battle.waveIndex + 1} offers three unique unowned cards`,
            candidates.length === 3 && new Set(candidates).size === 3 && candidates.every(id => !state.getRunState().takenRewardIds.includes(id)));
          rewardRounds.push({ wave: battle.waveIndex, candidates });
          const rank = ['烈日祝福', '战争号角', '风之羽', '硬化弹头', '速射护腕', '橡木之心', '维修装甲', '铁木壁垒', '树皮护甲'];
          const card = [...options].sort((a, b) => {
            const score = o => { const i = rank.indexOf(o.list.find(t => rank.includes(t.text))?.text); return i < 0 ? 99 : i; };
            return score(a) - score(b);
          })[0];
          click(card.x, card.y);
        }
        const alive = battle.enemies.filter(e => e.alive);
        const boss = alive.find(e => e.stats.type === 'boss');
        if (boss) seenBoss = boss;
        if (seenBoss?.hp === 0) bossKilled = true;
        if (shooting && battle.mode === 'fight') {
          const target = boss || [...alive].sort((a, b) => a.x - b.x)[0];
          if (target) {
            mouse('mousemove', target.x, target.y);
            if (!battle.pointerHeld) mouse('mousedown', target.x, target.y);
            if (battle.skillRemaining === 0 && (alive.length >= 3 || boss)) key(' ', 32);
          }
        }
        step();
      }
      mouse('mouseup', 700, 270);
      check(`G2-09: ${shooting ? 'armed' : 'unarmed'} run reaches result`, game.scene.isActive('Result'), { frame, wave: battle.waveIndex, mode: battle.mode });
      const summary = game.scene.keys.Result.summary;
      const killed = [...seenEnemies].filter(enemy => enemy.hp === 0);
      const killGold = killed.reduce((sum, enemy) => sum + enemy.goldReward, 0);
      const rewardGold = summary.takenRewardIds.reduce((sum, id) => {
        const { effect } = REWARD_CONFIGS.find(reward => reward.id === id);
        return sum + (effect.kind === 'gold' ? effect.value : 0);
      }, 0);
      check(`G3-04/08: ${shooting ? 'armed' : 'unarmed'} run result matches kill and reward gold ledger`,
        summary.gold === killGold + rewardGold && summary.kills === killed.length, { killGold, rewardGold, kills: killed.length });
      return { ...summary, baseHp: state.getRunState().baseHp, bossKilled, frames: frame, waveStarts, rewardRounds };
    };
    const naturalLoss = playRun(false);
    check('G2-09: natural enemy waves exhaust base and lose without state cheats', !naturalLoss.win && naturalLoss.baseHp === 0 && naturalLoss.kills === 0, naturalLoss);
    const victory = playRun(true);
    check('G2-09: real attacks clear five waves, kill boss, and win', victory.win && victory.wave === WAVE_CONFIGS.length - 1 && victory.bossKilled && victory.takenRewardIds.length === 4, victory);
    check('G3-01/06/10: consecutive waves and four distinct upgrades lead to boss victory',
      victory.waveStarts.join() === '0,1,2,3,4' && victory.rewardRounds.map(round => round.wave).join() === '0,1,2,3' &&
      new Set(victory.takenRewardIds).size === 4 && victory.baseHp > 0);
    return { checks, naturalLoss, victory, screenshots, coverage: [
      'G2-01', 'G2-02', 'G2-03', 'G2-04', 'G2-05', 'G2-06', 'G2-07', 'G2-08', 'G2-09',
      'G3-01', 'G3-02', 'G3-03', 'G3-04', 'G3-05', 'G3-06', 'G3-07', 'G3-08', 'G3-09', 'G3-10'
    ] };
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
    Phaser.Math.RND.state(rngState);
    audio.setMuted(originalMuted);
    if (oldBest === null) localStorage.removeItem('qoder-defense-best');
    else localStorage.setItem('qoder-defense-best', oldBest);
    game.step(time, 0);
  }
}
