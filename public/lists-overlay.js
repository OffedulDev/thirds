const stage = document.querySelector('#list-stage');
const listCard = document.querySelector('.break-card:not(.psa-card)');
const psaCard = document.querySelector('#voting-psa');
const logo = document.querySelector('#break-logo');
const fallback = document.querySelector('#break-fallback');
const listName = document.querySelector('#break-name');
const motto = document.querySelector('#break-motto');
const candidateList = document.querySelector('#break-candidate-list');
const noCandidates = document.querySelector('#break-empty');
const emptyState = document.querySelector('#break-empty-state');
let slides = [];
let currentIndex = 0;
let rotationTimer;
let renderToken = 0;
let candidateScrollFrame;
let candidateScrollTime = 0;
let candidateScrollOffset = 0;
let candidateScrollDirection = 1;
let candidateScrollPauseUntil = 0;

function durationFor(workflow) {
  const count = Array.isArray(workflow.candidates) ? workflow.candidates.length : 0;
  return Math.max(10000, 5000 + count * 1600);
}

function slideDuration(slide) {
  return slide.type === 'psa' ? 24000 : durationFor(slide.workflow);
}

function stopCandidateScroll() {
  cancelAnimationFrame(candidateScrollFrame);
  candidateScrollFrame = null;
  candidateScrollTime = 0;
}

function startCandidateScroll() {
  stopCandidateScroll();
  if (candidateList.scrollHeight <= candidateList.clientHeight + 2) return;
  candidateScrollDirection = 1;
  candidateScrollOffset = candidateList.scrollTop;
  candidateScrollPauseUntil = performance.now() + 900;
  const tick = now => {
    if (!stage.classList.contains('is-visible')) return stopCandidateScroll();
    if (!candidateScrollTime) candidateScrollTime = now;
    const elapsed = Math.min(50, now - candidateScrollTime);
    candidateScrollTime = now;
    if (now >= candidateScrollPauseUntil) {
      const end = candidateList.scrollHeight - candidateList.clientHeight;
      candidateScrollOffset = Math.max(0, Math.min(end, candidateScrollOffset + candidateScrollDirection * elapsed * .04));
      candidateList.scrollTop = Math.round(candidateScrollOffset);
      if (candidateScrollOffset >= end) {
        candidateScrollOffset = end;
        candidateList.scrollTop = end;
        candidateScrollDirection = -1;
        candidateScrollPauseUntil = now + 900;
      } else if (candidateScrollOffset <= 0 && candidateScrollDirection < 0) {
        candidateScrollOffset = 0;
        candidateList.scrollTop = 0;
        candidateScrollDirection = 1;
        candidateScrollPauseUntil = now + 900;
      }
    }
    candidateScrollFrame = requestAnimationFrame(tick);
  };
  candidateScrollFrame = requestAnimationFrame(tick);
}

function showSlide(index) {
  const slide = slides[index];
  if (!slide) return;
  stopCandidateScroll();
  currentIndex = index;
  const token = ++renderToken;
  stage.classList.add('is-leaving');
  stage.classList.remove('is-visible');

  setTimeout(() => {
    if (token !== renderToken) return;
    const isPsa = slide.type === 'psa';
    listCard.hidden = isPsa;
    psaCard.hidden = !isPsa;
    if (isPsa) {
      stage.classList.remove('is-leaving');
      requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('is-visible')));
      return;
    }
    const workflow = slide.workflow;
    listName.textContent = workflow.name || '';
    motto.textContent = workflow.motto || '';
    motto.hidden = !workflow.motto;
    fallback.textContent = String(workflow.name || '?').trim().slice(0, 2).toUpperCase();
    fallback.hidden = Boolean(workflow.logo);
    logo.hidden = !workflow.logo;
    logo.onerror = () => { logo.hidden = true; fallback.hidden = false; };
    logo.onload = () => { logo.hidden = false; fallback.hidden = true; };
    if (workflow.logo && logo.src !== new URL(workflow.logo, location.href).href) logo.src = workflow.logo;
    if (!workflow.logo) logo.removeAttribute('src');

    const candidates = Array.isArray(workflow.candidates) ? workflow.candidates : [];
    candidateList.replaceChildren();
    for (const candidate of candidates) {
      const item = document.createElement('li');
      item.textContent = candidate;
      candidateList.append(item);
    }
    candidateList.scrollTop = 0;
    noCandidates.hidden = candidates.length > 0;
    stage.classList.remove('is-leaving');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      stage.classList.add('is-visible');
      startCandidateScroll();
    }));
  }, 420);
}

function render(state) {
  const next = Array.isArray(state.workflows) ? state.workflows : [];
  const previousSlide = slides[currentIndex];
  slides = [];
  for (let index = 0; index < next.length; index++) {
    slides.push({ type: 'list', workflow: next[index] });
    if ((index + 1) % 2 === 0) slides.push({ type: 'psa' });
  }
  clearTimeout(rotationTimer);

  emptyState.hidden = next.length > 0;
  if (!next.length) {
    stopCandidateScroll();
    listCard.hidden = true;
    psaCard.hidden = true;
    stage.classList.remove('is-visible', 'is-leaving');
    currentIndex = 0;
    return;
  }

  let retainedIndex = -1;
  if (previousSlide?.type === 'psa') retainedIndex = slides.findIndex(slide => slide.type === 'psa');
  else if (previousSlide?.type === 'list') retainedIndex = slides.findIndex(slide => slide.type === 'list' && slide.workflow.id === previousSlide.workflow.id);
  currentIndex = retainedIndex >= 0 ? retainedIndex : Math.min(currentIndex, slides.length - 1);
  showSlide(currentIndex);
  scheduleNext();
}

function scheduleNext() {
  clearTimeout(rotationTimer);
  if (slides.length < 2) return;
  rotationTimer = setTimeout(() => {
    showSlide((currentIndex + 1) % slides.length);
    scheduleNext();
  }, slideDuration(slides[currentIndex]));
}

fetch('/api/state').then(response => response.json()).then(render).catch(() => {});
const events = new EventSource('/api/events');
events.onmessage = event => render(JSON.parse(event.data));
