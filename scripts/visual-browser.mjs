import * as Phaser from 'phaser';
import * as state from '../src/game/state/GameState.ts';
import { AssetKeys, TitleKeys } from '../src/game/types/index.ts';
import { DIFFICULTY_CONFIGS } from '../src/game/data/DifficultyConfig.ts';
import { PLAYER_CONFIG, BASE_LINE_X } from '../src/game/data/PlayerConfig.ts';
import { REWARD_CONFIGS } from '../src/game/data/RewardConfig.ts';
import { Projectile } from '../src/game/entities/Projectile.ts';
import { audio } from '../src/game/systems/AudioSystem.ts';

// Browser-side companion to combat-browser.mjs. Invoke with CDP userGesture: true;
// WebAudio runs on real time, independently of the manually advanced Phaser clock.
export async function runVisualChecks() {
  const checks = [];
  const screenshots = {};
  window.__visualChecks = checks;
  const game = window.game;
  const originalNow = Date.now;
  const originalRandom = Math.random;
  const originalMatchMedia = window.matchMedia;
  const matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const rngState = Phaser.Math.RND.state();
  const originalAudio = { muted: audio.isMuted(), paused: audio.paused, hidden: audio.hidden };
  const savedStorage = new Map(['qoder-defense-best', 'qoder-defense-muted'].map(key => [key, localStorage.getItem(key)]));
  const wasRunning = game?.loop.running;
  const loopCallback = game?.loop.callback;
  let time = performance.now();
  let wall = originalNow();
  let seed = 20261125;
  let reducedMotion = false;
  let battle;
  const watchedSources = new Map();
  const seenHeadings = new Set();
  const removers = [];
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
  const settle = async (name, predicate, evidence = () => ({}), timeout = 4000) => {
    const deadline = performance.now() + timeout;
    while (!predicate() && performance.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 20));
    }
    check(name, predicate(), evidence());
  };
  const mouse = (type, x, y, buttons = type === 'mouseup' ? 0 : 1) => {
    const rect = game.canvas.getBoundingClientRect();
    game.canvas.dispatchEvent(new MouseEvent(type, {
      clientX: rect.left + x * rect.width / 960,
      clientY: rect.top + y * rect.height / 540,
      button: 0, buttons, bubbles: true
    }));
  };
  const click = (x, y) => {
    // headlessStep does not render: refresh the display list/hit-test transforms first.
    game.step(time, 0);
    mouse('mousemove', x, y, 0);
    mouse('mousedown', x, y);
    step();
    mouse('mouseup', x, y);
    step(2);
  };
  const keyEvent = (type, value, repeat = false) => {
    const keyCode = { Enter: 13, Escape: 27, ' ': 32 }[value] ?? value.charCodeAt(0);
    const code = { Enter: 'Enter', Escape: 'Escape', ' ': 'Space' }[value] ?? `Digit${value}`;
    window.dispatchEvent(new KeyboardEvent(type, { key: value, code, keyCode, which: keyCode, repeat, bubbles: true }));
  };
  const key = (value, repeat = false) => {
    keyEvent('keydown', value, repeat);
    step();
    keyEvent('keyup', value);
    step();
  };
  const objects = root => {
    const result = [];
    const visit = item => {
      if (!item) return;
      result.push(item);
      if (Array.isArray(item.list)) item.list.forEach(visit);
    };
    if (root?.children?.list) root.children.list.forEach(visit);
    else visit(root);
    return result;
  };
  const visible = object => {
    if (!object?.active || !object.visible || !object.scene?.sys.isActive()) return false;
    for (let item = object; item; item = item.parentContainer) {
      if (item.visible === false || item.alpha <= 0.01) return false;
    }
    return true;
  };
  const inCanvas = object => {
    const b = object.getBounds();
    return b.width > 0 && b.height > 0 && b.left >= -1 && b.top >= -1 && b.right <= 961 && b.bottom <= 541;
  };
  const heading = (root, texture, maxWidth = 960, maxHeight = 540) => {
    const image = objects(root).find(item => item.name === texture);
    check(`visual: visible, aspect-preserving ${texture}`, image instanceof Phaser.GameObjects.Image &&
      image.texture.key === texture && visible(image) && inCanvas(image) &&
      Math.abs(image.scaleX - image.scaleY) < 1e-6 &&
      Math.abs(image.displayWidth / image.displayHeight - image.width / image.height) < 1e-6 &&
      image.displayWidth <= maxWidth + 0.1 && image.displayHeight <= maxHeight + 0.1,
    { type: image?.type, texture: image?.texture?.key, size: image && [image.displayWidth, image.displayHeight] });
    seenHeadings.add(texture);
    return image;
  };
  const button = (root, label) => {
    const text = objects(root).find(item => item.text === label && item.parentContainer?.input?.enabled);
    check(`input: rendered button ${label}`, !!text && visible(text) && inCanvas(text));
    const bounds = text.parentContainer.getBounds();
    click(bounds.centerX, bounds.centerY);
  };
  const capture = name => {
    game.step(time, 0);
    // Inspect actual rendered pixels as well as retaining the full PNG, not a DOM placeholder.
    const probe = document.createElement('canvas');
    probe.width = 96;
    probe.height = 54;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(game.canvas, 0, 0, 96, 54);
    const pixels = ctx.getImageData(0, 0, 96, 54).data;
    const colors = new Set();
    let opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      colors.add((pixels[i] >> 3) * 1024 + (pixels[i + 1] >> 3) * 32 + (pixels[i + 2] >> 3));
      if (pixels[i + 3] > 240) opaque++;
    }
    const png = game.canvas.toDataURL('image/png');
    screenshots[`visual-${name}`] = png;
    check(`snapshot: visual-${name} contains rendered canvas pixels`,
      png.startsWith('data:image/png;base64,') && opaque > 96 * 54 * 0.9 && colors.size > 30,
      { canvas: [game.canvas.width, game.canvas.height], colors: colors.size });
  };
  const start = (scene, data) => {
    for (const active of game.scene.getScenes(true)) game.scene.stop(active.sys.settings.key);
    game.scene.processQueue();
    game.scene.start(scene, data);
    game.scene.processQueue();
    step(2);
    return game.scene.keys[scene];
  };
  const fresh = (difficulty = 'normal') => {
    state.resetRun(difficulty);
    battle = start('Battle');
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
  const sparks = scene => objects(scene).filter(item => item.type === 'ParticleEmitter' && item.texture?.key === AssetKeys.Spark);
  const rewardState = () => {
    const s = state.getRunState();
    return { baseHp: s.baseHp, baseMaxHp: s.baseMaxHp, baseDefense: s.baseDefense, gold: s.gold,
      attackDamageBonus: s.attackDamageBonus, fireRateBonus: s.fireRateBonus, takenRewardIds: [...s.takenRewardIds] };
  };
  const expectedReward = (before, reward) => {
    const after = { ...before, takenRewardIds: [...before.takenRewardIds, reward.id] };
    const { kind, value } = reward.effect;
    if (kind === 'baseHp') {
      after.baseMaxHp += value;
      after.baseHp = Math.min(after.baseMaxHp, after.baseHp + value);
    } else {
      const field = { damage: 'attackDamageBonus', speed: 'fireRateBonus', defense: 'baseDefense', gold: 'gold' }[kind];
      after[field] += value;
    }
    return after;
  };
  const cards = () => battle.rewardPanel.root.list.filter(item => typeof item.getData('choose') === 'function');
  const watchMood = mood => {
    const source = audio.musicSource;
    check(`audio: ${mood} scene uses its real looping buffer`, audio.mood === mood && audio.ctx?.state === 'running' &&
      source instanceof AudioBufferSourceNode && source.loop && source.buffer === audio.musicBuffers.get(mood),
    { mood: audio.mood, state: audio.ctx?.state, duration: source?.buffer?.duration });
    if (!watchedSources.has(source)) {
      const record = { mood, ended: false };
      const ended = () => { record.ended = true; };
      source.addEventListener('ended', ended);
      removers.push(() => source.removeEventListener('ended', ended));
      watchedSources.set(source, record);
    }
    audio.setMood(mood);
    check(`audio: repeated ${mood} mood retains source`, audio.musicSource === source);
  };

  try {
    check('visual: live 960x540 Phaser game', !!game?.renderer && game.scale.gameSize.width === 960 && game.scale.gameSize.height === 540);
    game.loop.stop();
    Date.now = () => wall;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    Phaser.Math.RND.sow(['visual-checks']);
    window.matchMedia = function (query) {
      const media = originalMatchMedia.call(this, query);
      if (!String(query).includes('prefers-reduced-motion')) return media;
      return new Proxy(media, {
        get(target, property) {
          if (property === 'matches') return String(query).includes('no-preference') ? !reducedMotion : reducedMotion;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    };
    audio.setHidden(false);
    audio.setMuted(false);
    audio.setPaused(false);
    // This direct call is intentionally within the CDP evaluation's user gesture.
    audio.unlock();
    await settle('audio: real AudioContext unlocks under CDP user gesture', () => audio.ctx?.state === 'running',
      () => ({ state: audio.ctx?.state ?? 'missing', userActivation: navigator.userActivation?.isActive }));
    check('audio: native context and independent ambience are live',
      audio.ctx instanceof (window.AudioContext ?? window.webkitAudioContext) &&
      audio.master instanceof GainNode && audio.musicGain instanceof GainNode &&
      audio.ambienceSource instanceof AudioBufferSourceNode && audio.ambienceSource.loop && audio.birdTimer !== null);

    for (const [name, texture] of Object.entries(TitleKeys)) {
      const loaded = game.textures.exists(texture);
      const source = loaded ? game.textures.get(texture).getSourceImage() : null;
      check(`assets: ${name} title is a decoded image`, loaded && source instanceof HTMLImageElement &&
        source.complete && source.naturalWidth > 0 && source.naturalHeight > 0,
      { key: texture, size: source && [source.width, source.height] });
    }
    check('assets: all nine distinct AI title keys are present', Object.keys(TitleKeys).length === 9 && new Set(Object.values(TitleKeys)).size === 9);

    state.resetRun('normal');
    const menu = start('MainMenu');
    watchMood('menu');
    const menuTitle = heading(menu, TitleKeys.Game, 560, 150);
    check('menu: title is centered above controls', menuTitle.x === 480 && menuTitle.y === 106 && menuTitle.getBounds().bottom < 198);
    for (const [index, difficulty] of ['easy', 'normal', 'hard'].entries()) {
      key(String(index + 1));
      check(`menu: key ${index + 1} selects ${difficulty} and updates explanation`,
        state.getRunState().difficulty === difficulty && menu.descriptionText.text === DIFFICULTY_CONFIGS[difficulty].description && visible(menu.descriptionText));
    }
    key('1', true);
    check('menu: held/repeated difficulty key is ignored', state.getRunState().difficulty === 'hard');
    key('2');
    capture('menu');
    click(480, 448);
    step(15);
    const help = menu.howto;
    heading(help, TitleKeys.Help, 250, 62);
    check('help: real instructions are legible within the canvas', objects(help).some(item =>
      typeof item.text === 'string' && item.text.includes('Boss') && item.text.includes('1 / 2 / 3') && visible(item) && inCanvas(item)));
    key('Enter');
    key('3');
    check('help: modal blocks menu Enter and difficulty shortcuts', game.scene.isActive('MainMenu') && menu.howto === help && state.getRunState().difficulty === 'normal');
    capture('help');
    key('Escape');
    check('help: ESC destroys modal and unregisters its handler', menu.howto === null && menu.howtoKeys === null && !help.active);
    key('Enter');
    battle = game.scene.keys.Battle;
    check('menu: Enter starts a fresh normal battle', game.scene.isActive('Battle') && state.getRunState().baseHp === DIFFICULTY_CONFIGS.normal.baseHp && !menu.menuKeys);
    watchMood('battle');
    battle.beginWave();
    battle.spawnQueue = [];
    battle.spawnClock = -1e9;
    const marching = spawn('grunt', 690, 258);
    spawn('runner', 805, 345);
    spawn('grunt', 905, 185);
    step(32);
    capture('battle');

    await settle('audio: normal music level settles', () => audio.musicGain.gain.value > 0.3);
    const normalMusicLevel = audio.musicGain.gain.value;
    const battleMusic = audio.musicSource;
    click(912, 28);
    step(15);
    const pause = battle.pausePanel.root;
    heading(pause, TitleKeys.Pause, 230, 60);
    const frozen = JSON.stringify({ x: marching.x, elapsed: state.getRunState().elapsedMs, hp: state.getRunState().baseHp, cooldown: battle.skillRemaining });
    step(45);
    check('pause: real HUD pointer freezes simulation and blocks shooting', battle.paused && battle.pausePanel.visible && !battle.pointerHeld &&
      frozen === JSON.stringify({ x: marching.x, elapsed: state.getRunState().elapsedMs, hp: state.getRunState().baseHp, cooldown: battle.skillRemaining }));
    await settle('audio: pause lowers music without replacing its source', () => audio.paused && audio.musicSource === battleMusic && audio.musicGain.gain.value < normalMusicLevel / 2,
      () => ({ paused: audio.paused, gain: audio.musicGain.gain.value }));
    watchMood('battle');
    capture('pause');
    const muteBounds = battle.pausePanel.muteButton.container.getBounds();
    click(muteBounds.centerX, muteBounds.centerY);
    await settle('audio: pause mute silences master and all voices', () => audio.isMuted() && Math.abs(audio.master.gain.value) < 0.0001 && audio.voices.size === 0);
    check('pause: mute label tracks actual audio state', objects(pause).some(item => item.text === '♪ 声音已静音' && visible(item)));
    click(muteBounds.centerX, muteBounds.centerY);
    await settle('audio: unmute restores master gain', () => !audio.isMuted() && audio.master.gain.value > 0.8);
    key('Escape');
    step(5);
    check('pause: ESC resumes movement and destroys overlay', !battle.paused && !battle.pausePanel.visible && !pause.active && marching.x < JSON.parse(frozen).x);
    await settle('audio: resume restores full music level', () => !audio.paused && audio.musicGain.gain.value > 0.3);
    key('Escape');
    step(15);
    button(battle.pausePanel.root, '继续战斗');
    check('pause: canvas continue button resumes without firing through', !battle.paused && !battle.pointerHeld);
    click(806, 28);
    check('battle: HUD mute is interactive and does not shoot', audio.isMuted() && !battle.pointerHeld && battle.projectiles.length === 0);
    click(806, 28);
    check('battle: HUD unmute is interactive', !audio.isMuted());

    arena();
    const victim = spawn('grunt', 600, 270);
    spawn('grunt', 925, 420); // Keep the arena active while transient effects expire.
    const playerSprite = battle.player.sprite;
    battle.player.recoil();
    step(3);
    check('effects: recoil actually displaces the player sprite', playerSprite.x < -0.1);
    step(12);
    check('effects: recoil returns to its original position', Math.abs(playerSprite.x) < 0.001);
    const beforeSpark = new Set(sparks(battle));
    battle.hitSpark(victim.x, victim.y, true);
    const hitBursts = sparks(battle).filter(item => !beforeSpark.has(item));
    check('effects: critical hit emits living particles', hitBursts.length > 0 && hitBursts.every(item => item.getAliveParticleCount() > 0));
    victim.takeDamage(1);
    check('effects: nonfatal damage flashes the real enemy', victim.hp === victim.maxHp - 1 && victim.sprite.isTinted);
    step(6);
    check('effects: hit tint is cleared after its lifetime', !victim.sprite.isTinted);
    const sprite = victim.sprite;
    const oldScale = sprite.scaleX;
    const beforeDeath = new Set(sparks(battle));
    victim.takeDamage(victim.hp);
    const deathBursts = sparks(battle).filter(item => !beforeDeath.has(item));
    step(5);
    check('effects: death shrinks/fades its sprite and emits particles', !victim.alive && victim.active &&
      sprite.scaleX < oldScale && sprite.alpha < 1 && deathBursts.some(item => item.getAliveParticleCount() > 0));
    step(35);
    check('effects: hit/death bursts and corpse clean up', !victim.active && !battle.enemies.includes(victim) &&
      [...hitBursts, ...deathBursts].every(item => !item.active && !objects(battle).includes(item)));

    for (const digit of ['1', '2', '3']) {
      arena();
      state.damageBase(20);
      battle.hud.refresh();
      battle.waveCleared();
      step(48);
      watchMood('reward');
      heading(battle.rewardPanel.root, TitleKeys.Reward, 320, 76);
      const options = cards();
      const ids = options.map(card => card.getData('rewardId'));
      check(`rewards: key ${digit} round offers three real unique cards`, options.length === 3 && new Set(ids).size === 3 &&
        ids.every(id => REWARD_CONFIGS.some(reward => reward.id === id)) && options.every(card => visible(card) && inCanvas(card)), { ids });
      options.forEach((card, index) => {
        const reward = REWARD_CONFIGS.find(item => item.id === ids[index]);
        const preview = card.getByName('reward-preview');
        const s = state.getRunState();
        const { kind, value } = reward.effect;
        const current = { baseHp: s.baseMaxHp, gold: s.gold, damage: PLAYER_CONFIG.baseDamage + s.attackDamageBonus,
          speed: PLAYER_CONFIG.fireRate + s.fireRateBonus, defense: s.baseDefense }[kind];
        const format = number => kind === 'speed' ? number.toFixed(1) : String(number);
        const expectedPreview = `${format(current)} → ${format(current + value)}`;
        check(`rewards: ${reward.id} has accurate visible preview and key ${index + 1}`, preview instanceof Phaser.GameObjects.Text &&
          visible(preview) && inCanvas(preview) && preview.text.includes(expectedPreview) &&
          objects(card).some(item => item.text === reward.title && visible(item)) &&
          objects(card).some(item => item.text === String(index + 1) && visible(item)), { preview: preview?.text, expectedPreview });
      });
      if (digit === '1') capture('rewards');
      const before = rewardState();
      const elapsed = state.getRunState().elapsedMs;
      key(digit, true);
      check(`rewards: repeated ${digit} cannot select`, !battle.rewardPanel.locked && JSON.stringify(rewardState()) === JSON.stringify(before));
      const existingVoices = new Set(audio.voices.keys());
      const selected = REWARD_CONFIGS.find(item => item.id === ids[Number(digit) - 1]);
      const expected = expectedReward(before, selected);
      const root = battle.rewardPanel.root;
      key(digit);
      check(`rewards: ${digit} locks immediately but waits for selection animation`, battle.rewardPanel.locked && battle.rewardPanel.visible &&
        JSON.stringify(rewardState()) === JSON.stringify(before) && state.getRunState().elapsedMs === elapsed);
      key(digit === '3' ? '1' : '3');
      click(options[0].x, options[0].y);
      key('Escape');
      step(22);
      check(`rewards: ${digit} applies exactly its effect once despite competing inputs`,
        JSON.stringify(rewardState()) === JSON.stringify(expected) && battle.waveIndex === 1 && battle.mode === 'break' &&
        !battle.rewardPanel.visible && battle.rewardPanel.keyHandler === null && !root.active && !battle.pointerHeld,
      { expected, actual: rewardState() });
      const selectionVoices = [...audio.voices.keys()].filter(source => !existingVoices.has(source));
      check(`audio: successful reward ${digit} plays once, not once per competing input`, selectionVoices.length === 4 &&
        selectionVoices.every(source => source instanceof OscillatorNode && source.context === audio.ctx));
      watchMood('battle');
      const toast = battle.hud.upgradeToast;
      heading(toast, TitleKeys.Upgrade);
      check(`upgrade: ${selected.id} is shown in the actual HUD toast`, visible(toast) &&
        objects(toast).some(item => typeof item.text === 'string' && item.text.includes(selected.title) && visible(item)));
      if (digit === '1') {
        capture('upgrade');
        step(55);
        check('upgrade: toast remains visible before its 2600ms expiry', battle.hud.upgradeToast === toast && visible(toast));
        step(125);
        check('upgrade: toast and its children are destroyed after expiry', battle.hud.upgradeToast === null && !toast.active);
      }
    }
    for (const dismiss of ['blank', 'Escape']) {
      arena();
      battle.waveCleared();
      step(48);
      const root = battle.rewardPanel.root;
      const before = rewardState();
      if (dismiss === 'blank') click(16, 270);
      else key('Escape');
      check(`rewards: ${dismiss} skips without award, pause or firing through`, !battle.rewardPanel.visible && !root.active &&
        battle.waveIndex === 1 && battle.mode === 'break' && !battle.paused && !battle.pointerHeld &&
        JSON.stringify(rewardState()) === JSON.stringify(before));
      key('1');
      step(15);
      check(`rewards: ${dismiss} leaves no stale selection callback`, JSON.stringify(rewardState()) === JSON.stringify(before) && battle.waveIndex === 1);
    }

    fresh();
    battle.waveIndex = 4;
    battle.beginWave();
    battle.spawnQueue = [];
    battle.spawnClock = -1e9;
    const boss = spawn('boss', 760, 305);
    step(30);
    watchMood('boss');
    heading(battle.hud.banner, TitleKeys.Boss);
    boss.takeDamage(Math.floor(boss.maxHp / 4));
    step(6);
    check('boss: live HUD health follows actual boss damage', boss.alive && battle.hud.bossRoot.visible &&
      visible(battle.hud.bossHpText) && battle.hud.bossHpText.text.includes(`${boss.hp} / ${boss.maxHp}`),
    { hp: boss.hp, maxHp: boss.maxHp, label: battle.hud.bossHpText.text });
    const bossFill = battle.hud.bossBar.container.list.find(item => item.isCropped);
    check('boss: health bar crop reflects damaged HP', !!bossFill &&
      Math.abs(bossFill._crop.width / bossFill.width - boss.hp / boss.maxHp) < 0.01);
    capture('boss');
    localStorage.removeItem('qoder-defense-best'); // Guarantee a real record heading; restored below.
    const lethal = new Projectile(battle, boss.x, boss.y, boss.maxHp);
    lethal.launch(0, 0);
    battle.projectiles.push(lethal);
    battle.stepProjectiles(0);
    step(120);
    let result = game.scene.keys.Result;
    check('victory: actual boss death transitions into a winning result', game.scene.isActive('Result') && result.summary.win &&
      result.summary.wave === 4 && result.summary.kills === 1 && result.summary.gold === boss.goldReward);
    watchMood('victory');
    heading(result, TitleKeys.Victory, 310, 82);
    heading(result, TitleKeys.Record, 105, 40);
    const victorySummary = { ...result.summary, takenRewardIds: [...result.summary.takenRewardIds] };
    const celebrations = sparks(result);
    check('victory: real celebration particles are alive', celebrations.some(item => item.getAliveParticleCount() > 0));
    capture('victory');
    step(105);
    check('victory: celebration emitters expire instead of accumulating', celebrations.every(item => !item.active));
    key('Escape');
    check('result: ESC returns to menu and removes result key handlers', game.scene.isActive('MainMenu') &&
      result.input.keyboard.listenerCount('keydown-ESC') === 0 && result.input.keyboard.listenerCount('keydown-ENTER') === 0);
    watchMood('menu');

    arena();
    state.damageBase(state.getRunState().baseHp - 1);
    spawn('grunt', BASE_LINE_X, 270);
    step(100);
    result = game.scene.keys.Result;
    check('defeat: fatal contact transitions into a losing result', game.scene.isActive('Result') && !result.summary.win && state.getRunState().baseHp === 0);
    watchMood('defeat');
    heading(result, TitleKeys.Defeat, 310, 82);
    capture('defeat');
    key('Enter');
    battle = game.scene.keys.Battle;
    check('result: Enter restarts with fresh state and one input handler', game.scene.isActive('Battle') &&
      state.getRunState().baseHp === 100 && state.getRunState().takenRewardIds.length === 0 &&
      battle.input.keyboard.listenerCount('keydown-ESC') === 1 && result.input.keyboard.listenerCount('keydown-ENTER') === 0);
    watchMood('battle');

    reducedMotion = true;
    arena();
    const reducedBoss = spawn('boss', 900, 400);
    const reducedEnemy = spawn('grunt', 790, 160);
    const reducedSprite = battle.player.sprite;
    const stationary = { x: reducedSprite.x, scaleX: reducedSprite.scaleX, scaleY: reducedSprite.scaleY };
    const enemyScale = [reducedEnemy.sprite.scaleX, reducedEnemy.sprite.scaleY];
    battle.player.recoil();
    battle.hitSpark(700, 230, true);
    key(' ');
    check('reduced motion: skill still fires real projectiles', battle.projectiles.length === PLAYER_CONFIG.skillArrows && battle.skillRemaining > 0);
    let quiet = true;
    for (let frame = 0; frame < 12; frame++) {
      step();
      quiet &&= !battle.cameras.main.shakeEffect.isRunning && !battle.cameras.main.flashEffect.isRunning && sparks(battle).length === 0 &&
        reducedSprite.x === stationary.x && reducedSprite.scaleX === stationary.scaleX && reducedSprite.scaleY === stationary.scaleY &&
        reducedEnemy.sprite.scaleX === enemyScale[0] && reducedEnemy.sprite.scaleY === enemyScale[1];
    }
    check('reduced motion: boss, skill, hit and recoil cause no shakes, scales or bursts', quiet);
    reducedEnemy.takeDamage(reducedEnemy.maxHp);
    let deathQuiet = sparks(battle).length === 0;
    for (let frame = 0; frame < 36; frame++) {
      if (reducedEnemy.active) deathQuiet &&= reducedEnemy.sprite.scaleX === enemyScale[0] && reducedEnemy.sprite.scaleY === enemyScale[1];
      step();
      deathQuiet &&= sparks(battle).length === 0;
    }
    check('reduced motion: death cleans up without shrink or particles', deathQuiet && !reducedEnemy.active && reducedBoss.alive);
    key('Escape');
    check('reduced motion: pause appears at full scale and opacity', battle.pausePanel.root.scaleX === 1 && battle.pausePanel.root.scaleY === 1 && battle.pausePanel.root.alpha === 1);
    key('Escape');
    arena();
    battle.waveCleared();
    const reducedCards = cards();
    check('reduced motion: rewards are immediately readable at full scale', reducedCards.length === 3 &&
      reducedCards.every(card => card.alpha === 1 && card.scaleX === 1 && card.scaleY === 1));
    heading(battle.rewardPanel.root, TitleKeys.Reward, 320, 76);
    game.step(time, 0);
    mouse('mousemove', reducedCards[2].x, reducedCards[2].y, 0);
    step(2);
    check('reduced motion: card hover does not enlarge it', reducedCards[2].scaleX === 1 && reducedCards[2].scaleY === 1);
    capture('reduced-motion');
    const reducedBefore = rewardState();
    const reducedReward = REWARD_CONFIGS.find(item => item.id === reducedCards[2].getData('rewardId'));
    keyEvent('keydown', '3');
    check('reduced motion: keyboard selection applies immediately without 180ms delay', battle.mode === 'break' &&
      !battle.rewardPanel.visible && JSON.stringify(rewardState()) === JSON.stringify(expectedReward(reducedBefore, reducedReward)));
    keyEvent('keyup', '3');
    key('1');
    check('reduced motion: rapid follow-up key cannot award twice', state.getRunState().takenRewardIds.join() === reducedReward.id);
    heading(battle.hud.upgradeToast, TitleKeys.Upgrade);
    const reducedResult = start('Result', victorySummary);
    check('reduced motion: victory omits celebration bursts but keeps its art', sparks(reducedResult).length === 0);
    heading(reducedResult, TitleKeys.Victory, 310, 82);

    const waveformEvidence = [];
    for (const mood of ['menu', 'battle', 'boss', 'reward', 'victory', 'defeat']) {
      const buffer = audio.musicBuffers.get(mood);
      check(`audio: ${mood} has a native stereo PCM loop`, buffer instanceof AudioBuffer && buffer.numberOfChannels === 2 && buffer.duration > 1);
      let peak = 0, energy = 0, stereoDifference = 0, finite = true, positive = false, negative = false, hash = 2166136261;
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      for (let i = 0; i < left.length; i++) {
        const l = left[i], r = right[i];
        finite &&= Number.isFinite(l) && Number.isFinite(r);
        peak = Math.max(peak, Math.abs(l), Math.abs(r));
        energy += l * l + r * r;
        stereoDifference += Math.abs(l - r);
        positive ||= l > 0.001;
        negative ||= l < -0.001;
        hash = Math.imul(hash ^ Math.round(l * 1e6), 16777619) >>> 0;
      }
      const rms = Math.sqrt(energy / (left.length * 2));
      const evidence = { mood, frames: buffer.length, duration: buffer.duration, sampleRate: buffer.sampleRate, peak, rms, hash };
      waveformEvidence.push(evidence);
      check(`audio: ${mood} waveform is finite, non-silent, stereo and unclipped`, finite && positive && negative &&
        peak > 0.01 && peak <= 0.83 && rms > 0.001 && stereoDifference / left.length > 0.0001, evidence);
    }
    check('audio: all six generated music loops have distinct PCM', new Set(waveformEvidence.map(item => item.hash)).size === 6,
      { scope: 'Waveform and lifecycle only; headless execution cannot verify auditory quality.', loops: waveformEvidence });
    await settle('audio: every replaced music source has actually ended', () =>
      [...watchedSources].every(([source, record]) => source === audio.musicSource || record.ended),
    () => ({ pendingMoods: [...watchedSources].filter(([source, record]) => source !== audio.musicSource && !record.ended).map(([, record]) => record.mood) }));
    const voicesBefore = new Set(audio.voices.keys());
    audio.play('reward');
    const sound = [...audio.voices.keys()].filter(source => !voicesBefore.has(source));
    check('audio: reward cue schedules real finite voices', sound.length === 4 && sound.every(source => source instanceof OscillatorNode));
    await settle('audio: completed reward voices release their nodes', () => sound.every(source => !audio.voices.has(source)));
    const retainedMusic = audio.musicSource;
    const retainedAmbience = audio.ambienceSource;
    audio.setHidden(true);
    await settle('audio: hidden suspends context, mutes and clears voices/timer', () => audio.ctx.state === 'suspended' &&
      audio.master.gain.value === 0 && audio.voices.size === 0 && audio.birdTimer === null,
    () => ({ state: audio.ctx.state, hidden: audio.hidden, gain: audio.master.gain.value, voices: audio.voices.size, birdTimer: audio.birdTimer }));
    audio.setHidden(false);
    await settle('audio: visible resumes real context without duplicating loops', () => audio.ctx.state === 'running' &&
      audio.master.gain.value > 0.8 && audio.musicSource === retainedMusic && audio.ambienceSource === retainedAmbience && audio.birdTimer !== null);
    check('visual: all nine title images appeared in real scenes', Object.values(TitleKeys).every(texture => seenHeadings.has(texture)));
    const required = ['menu', 'help', 'battle', 'pause', 'rewards', 'upgrade', 'boss', 'victory', 'defeat', 'reduced-motion'];
    check('visual: all ten required snapshots are distinct', required.every(name => screenshots[`visual-${name}`]) &&
      new Set(required.map(name => screenshots[`visual-${name}`])).size === required.length);
    return { checks, screenshots };
  } catch (error) {
    if (checks.at(-1)?.pass !== false) checks.push({ name: 'visual: unexpected browser exception', pass: false, error: error?.stack ?? String(error) });
    throw error;
  } finally {
    removers.forEach(remove => remove());
    Date.now = originalNow;
    Math.random = originalRandom;
    Phaser.Math.RND.state(rngState);
    if (matchMediaDescriptor) Object.defineProperty(window, 'matchMedia', matchMediaDescriptor);
    else delete window.matchMedia;
    audio.setMuted(originalAudio.muted);
    audio.setPaused(originalAudio.paused);
    audio.setHidden(originalAudio.hidden);
    for (const [key, value] of savedStorage) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    if (game?.renderer) game.step(time, 0);
    if (wasRunning) game.loop.start(loopCallback);
  }
}
