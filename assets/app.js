'use strict';

(() => {
  const tasks = window.WETLAB_TASKS;
  const byId = new Map(tasks.map(task => [task.id, task]));
  const dialog = document.querySelector('#image-dialog');
  let imageTrigger = null;
  let speed = 1;

  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const padded = number => String(number).padStart(2, '0');
  const time = seconds => `${Math.floor(seconds / 60)}:${padded(Math.floor(seconds % 60))}`;
  const familyNames = {HP: 'Handling & Placement', TM: 'Transfer & Mixing', IO: 'Instrument Operation', MD: 'Measurement & Dosing'};
  const capabilityNames = window.WETLAB_TERMINOLOGY.capabilities;
  const scopeName = task => task.scope === 'operation' ? 'Basic operation' : 'Experimental procedure';
  const SKILLS = ['grasp', 'pick', 'place', 'pour', 'stir', 'press', 'pull', 'push', 'insert', 'turn', 'handover', 'align', 'shake', 'scoop'];
  // All atomic skills credited by a task's metrics; the overview table lists only representative ones.
  for (const task of tasks) {
    task.allSkills = SKILLS.filter(skill => task.distinctive_skills.includes(skill) ||
      task.metrics.some(metric => metric.skills.split(/,\s*/).includes(skill)));
  }

  for (const [split, heading] of [['train', 'Demonstrated Tasks'], ['ood', 'Zero-shot Tasks']]) {
    const group = document.createElement('tbody');
    group.innerHTML = `<tr class="suite-group"><th colspan="9" scope="colgroup">${heading}</th></tr>`;
    for (const task of tasks.filter(task => task.split === split)) {
      const row = document.createElement('tr');
      row.innerHTML = `<td class="suite-id">${padded(task.id)}</td><td class="suite-family">${task.families.join(' + ')}</td><th scope="row"><a href="#task-${padded(task.id)}">${escape(task.title)}</a></th><td>${task.scope === 'operation' ? 'Op.' : 'Proc.'}</td><td>${task.horizon}</td><td>${task.precision}</td><td>${task.quantitative_target}</td><td>${task.reaction_observation}</td><td>${escape(task.distinctive_skills.join(', '))}</td>`;
      group.append(row);
    }
    document.querySelector('#task-suite-table').append(group);
  }

  function createCard(task) {
    const number = padded(task.id);
    const card = document.createElement('article');
    card.id = `task-${number}`;
    card.className = 'task-card';
    card.dataset.id = task.id;
    card.setAttribute('aria-labelledby', `title-${number}`);
    const media = task.split === 'train' ? `
      <button class="media-button" type="button" data-play="${task.id}" aria-label="Play ${escape(task.title)} video, ${time(task.duration)}">
        <img src="${task.poster}" width="${task.width}" height="${task.height}" alt="" loading="${task.id <= 2 ? 'eager' : 'lazy'}" decoding="async">
        <span class="play-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.7a1 1 0 0 1 1.5-.86l14 8.3a1 1 0 0 1 0 1.72l-14 8.3a1 1 0 0 1-1.5-.86z"/></svg></span>
        <span class="media-caption"><span>Watch demonstration</span><span class="duration">${time(task.duration)}</span></span>
      </button>` : `
      <button class="image-button" type="button" data-image="${task.id}" aria-label="Enlarge ${escape(task.title)} image">
        <img src="${task.media}" width="${task.width}" height="${task.height}" alt="Overlook view of ${escape(task.title)}" loading="lazy" decoding="async">
        <span class="image-label">ZERO-SHOT TASK</span><span class="image-expand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg></span>
      </button>`;
    const labels = Object.keys(capabilityNames).map(key =>
      `<div><dt>${capabilityNames[key]}</dt><dd${task[key] === 'Yes' ? ' class="required"' : ''}>${escape(task[key])}</dd></div>`).join('');
    const formatWeight = weight => Math.abs(weight - 1 / 6) < 1e-9 ? '1/6' : weight.toFixed(2);
    const rows = task.metrics.map(metric => `<tr>
      <td><span class="stage">${escape(metric.stage)}</span>${escape(metric.criterion)}</td>
      <td class="score">${formatWeight(metric.weight)}${metric.count > 1 ? ` <small>×${metric.count}</small>` : ''}</td>
      <td class="skills">${escape(metric.skills)}</td></tr>`).join('');
    card.innerHTML = `
      <div class="card-main"><header class="card-heading"><span class="task-number" aria-label="Task ${number}">${number}</span><h4 id="title-${number}"><a href="#task-${number}">${escape(task.title)}</a></h4></header>
      <div class="media-frame">${media}</div>
      <div class="card-body"><div class="task-taxonomy"><span>${task.families.map(family => escape(familyNames[family])).join(' + ')}</span><span>${scopeName(task)}</span></div><dl class="capabilities">${labels}</dl><p class="task-skills"><span>Skills</span>${escape(task.allSkills.join(', '))}</p><div class="instruction"><span class="instruction-label">Instruction</span><p>${escape(task.instruction)}</p></div></div></div>
      <details class="rubric"><summary><span>Metric, Score &amp; Skills</span></summary><div class="rubric-content"><table aria-label="Evaluation rubric for task ${number}: ${escape(task.title)}"><thead><tr><th scope="col" class="criterion-col">Metric</th><th scope="col" class="score-col">Score</th><th scope="col" class="skills-col">Skills</th></tr></thead><tbody>${rows}</tbody></table><p class="rubric-note">S1, S2, … are evaluation stages; a stage is scored only after the previous one is completed. Scores are criterion weights that sum to 1.00, and ×N marks N independently scored instances.</p></div></details>`;
    return card;
  }

  for (const task of tasks) {
    document.querySelector(task.split === 'train' ? '#training-grid' : '#ood-grid').append(createCard(task));
  }

  // Multi-select dropdown filters. Options combine with OR inside a filter and AND across filters.
  const level = value => ({ value, label: value });
  const FILTERS = [
    { key: 'family', label: 'Family', values: task => task.families,
      options: Object.entries(familyNames).map(([code, name]) => ({ value: code, label: `${code}: ${name}`, short: code })) },
    { key: 'scope', label: 'Scope', values: task => [task.scope],
      options: [{ value: 'operation', label: 'Op.: basic operation', short: 'Op.' }, { value: 'procedure', label: 'Proc.: experimental procedure', short: 'Proc.' }] },
    { key: 'horizon', label: 'Horizon', values: task => [task.horizon], options: ['Short', 'Medium', 'Long'].map(level) },
    { key: 'precision', label: 'Precision', values: task => [task.precision], options: ['Low', 'Medium', 'High'].map(level) },
    { key: 'quantitative_target', label: 'Q', title: capabilityNames.quantitative_target, values: task => [task.quantitative_target], options: ['Yes', 'No'].map(level) },
    { key: 'reaction_observation', label: 'R', title: capabilityNames.reaction_observation, values: task => [task.reaction_observation], options: ['Yes', 'No'].map(level) },
    { key: 'skills', label: 'Skills', title: 'Atomic skills used anywhere in the task', values: task => task.allSkills, options: SKILLS.map(level) },
  ];
  let openFilter = null;

  for (const filter of FILTERS) {
    filter.options = filter.options
      .map(option => ({ ...option, count: tasks.filter(task => filter.values(task).includes(option.value)).length }))
      .filter(option => option.count);
    filter.selected = new Set(filter.options.map(option => option.value));
    const wrapper = document.createElement('div');
    wrapper.className = 'filter';
    wrapper.innerHTML = `<button class="filter-button" type="button" aria-expanded="false" aria-controls="filter-${filter.key}"${filter.title ? ` title="${escape(filter.title)}"` : ''}><span class="filter-label">${escape(filter.label)}</span><span class="filter-value"></span></button>
      <div class="filter-panel" id="filter-${filter.key}" role="group" aria-label="${escape(filter.title ?? filter.label)}" hidden>
        ${filter.title ? `<p class="filter-title">${escape(filter.title)}</p>` : ''}
        <div class="filter-actions"><button type="button" data-select="all">Select all</button><button type="button" data-select="none">Clear</button></div>
        ${filter.options.map(option => `<label><input type="checkbox" value="${escape(option.value)}" checked><span>${escape(option.label)}</span><span class="option-count" aria-label="${option.count} tasks">${option.count}</span></label>`).join('')}
      </div>`;
    filter.button = wrapper.querySelector('.filter-button');
    filter.panel = wrapper.querySelector('.filter-panel');
    filter.button.addEventListener('click', () => (openFilter === filter ? closeFilter() : openPanel(filter)));
    filter.panel.addEventListener('change', event => {
      if (event.target.checked) filter.selected.add(event.target.value);
      else filter.selected.delete(event.target.value);
      applyFilters();
    });
    filter.panel.addEventListener('click', event => {
      const choice = event.target.closest('[data-select]');
      if (!choice) return;
      filter.selected = new Set(choice.dataset.select === 'all' ? filter.options.map(option => option.value) : []);
      applyFilters();
    });
    // Close when keyboard focus leaves; pointer clicks outside are handled on the document.
    wrapper.addEventListener('focusout', event => {
      if (openFilter === filter && event.relatedTarget && !wrapper.contains(event.relatedTarget)) closeFilter();
    });
    document.querySelector('#filters').append(wrapper);
  }

  function openPanel(filter) {
    closeFilter();
    filter.panel.hidden = false;
    filter.panel.classList.remove('align-right');
    if (filter.panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) filter.panel.classList.add('align-right');
    filter.button.setAttribute('aria-expanded', 'true');
    openFilter = filter;
  }

  function closeFilter(focusButton = false) {
    if (!openFilter) return;
    openFilter.panel.hidden = true;
    openFilter.button.setAttribute('aria-expanded', 'false');
    if (focusButton) openFilter.button.focus();
    openFilter = null;
  }

  function summary(filter) {
    const count = filter.selected.size;
    if (count === filter.options.length) return 'All';
    if (count === 0) return 'None';
    const chosen = filter.options.filter(option => filter.selected.has(option.value)).map(option => option.short ?? option.label);
    return count <= 2 ? chosen.join(', ') : `${count} of ${filter.options.length}`;
  }

  function applyFilters() {
    const shown = { train: 0, ood: 0 };
    for (const card of document.querySelectorAll('.task-card')) {
      const task = byId.get(Number(card.dataset.id));
      const matches = FILTERS.every(filter => filter.values(task).some(value => filter.selected.has(value)));
      card.hidden = !matches;
      if (matches) shown[task.split]++;
      else card.querySelector('video')?.pause();
    }
    let filtered = false;
    for (const filter of FILTERS) {
      const partial = filter.selected.size !== filter.options.length;
      filtered ||= partial;
      filter.button.querySelector('.filter-value').textContent = summary(filter);
      filter.button.classList.toggle('partial', partial);
      filter.panel.querySelectorAll('input').forEach(input => { input.checked = filter.selected.has(input.value); });
    }
    document.querySelector('#training-section').hidden = shown.train === 0;
    document.querySelector('#ood-section').hidden = shown.ood === 0;
    const count = shown.train + shown.ood;
    document.querySelector('#result-count').textContent = count === tasks.length ? `${count} tasks` : `${count} of ${tasks.length} tasks shown`;
    document.querySelector('#empty-state').hidden = count !== 0;
    document.querySelector('#reset-filters').hidden = !filtered;
    document.querySelector('#showcase .speed-control').hidden = shown.train === 0;
    equalizeCards();
  }

  function resetFilters() {
    for (const filter of FILTERS) filter.selected = new Set(filter.options.map(option => option.value));
    applyFilters();
  }

  function pauseAll(except = null) {
    document.querySelectorAll('video').forEach(video => { if (video !== except) video.pause(); });
  }

  const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting && !document.fullscreenElement && !entry.target.webkitDisplayingFullscreen) entry.target.pause();
    }
  }, { threshold: 0 }) : null;

  function showMediaError(frame, task) {
    if (frame.querySelector('.media-error')) return;
    const message = document.createElement('div');
    message.className = 'media-error';
    message.setAttribute('role', 'alert');
    message.innerHTML = `Video could not be loaded.<a href="${task.media}" target="_blank" rel="noopener noreferrer">Open video directly ↗</a>`;
    frame.append(message);
  }

  function playVideo(button) {
    const task = byId.get(Number(button.dataset.play));
    const frame = button.closest('.media-frame');
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.poster = task.poster;
    video.width = task.width;
    video.height = task.height;
    video.setAttribute('aria-label', `${task.title}, overlook demonstration`);
    video.setAttribute('tabindex', '0');
    video.addEventListener('play', () => pauseAll(video));
    video.addEventListener('loadedmetadata', () => { video.playbackRate = speed; });
    video.addEventListener('error', () => showMediaError(frame, task));
    video.src = task.media;
    button.replaceWith(video);
    videoObserver?.observe(video);
    video.focus({ preventScroll: true });
    video.playbackRate = speed;
    video.play().catch(error => {
      // Native controls remain available if autoplay policies interrupt playback.
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') showMediaError(frame, task);
    });
  }

  function showImage(button) {
    const task = byId.get(Number(button.dataset.image));
    pauseAll();
    imageTrigger = button;
    document.querySelector('#image-dialog-title').textContent = `${padded(task.id)} ${task.title}`;
    const image = document.querySelector('#dialog-image');
    image.src = task.media;
    image.alt = `Overlook view of ${task.title}`;
    document.querySelector('#original-image').href = task.media;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }

  document.addEventListener('click', event => {
    if (openFilter && !event.target.closest('.filter')) closeFilter();
    const play = event.target.closest('[data-play]');
    if (play) playVideo(play);
    const image = event.target.closest('[data-image]');
    if (image) showImage(image);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && openFilter) closeFilter(true); });
  document.querySelector('#playback-speed').addEventListener('change', event => {
    speed = Number(event.target.value);
    document.querySelectorAll('video').forEach(video => { video.playbackRate = speed; });
  });
  document.querySelectorAll('#reset-filters, #empty-reset').forEach(button => button.addEventListener('click', resetFilters));
  document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    imageTrigger?.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });

  function revealAnchor() {
    if (!/^#task-\d{2}$/.test(location.hash)) return;
    const card = document.querySelector(location.hash);
    if (!card) return;
    if (card.hidden) resetFilters();
    requestAnimationFrame(() => card.scrollIntoView({ block: 'start' }));
  }
  // In multi-column grids every card gets the height of the tallest one. The instruction absorbs the
  // extra space so the metric summary sits at the bottom; an opened rubric grows only its own card.
  const singleColumn = window.matchMedia('(max-width: 760px)');
  function equalizeCards() {
    const gallery = document.querySelector('#showcase');
    gallery.style.removeProperty('--card-main-height');
    if (singleColumn.matches) return;
    const heights = [...document.querySelectorAll('.task-card:not([hidden]) .card-main')].map(main => main.offsetHeight);
    if (heights.length) gallery.style.setProperty('--card-main-height', `${Math.max(...heights)}px`);
  }
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(equalizeCards);
  });
  document.fonts?.ready.then(equalizeCards);

  window.addEventListener('hashchange', revealAnchor);
  applyFilters();
  revealAnchor();
})();
